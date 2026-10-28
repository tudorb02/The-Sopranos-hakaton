import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { SCREEN_FIELDS } from "../src/read-model.js";

export async function buildOpenApi() {
  const baseline = JSON.parse(await readFile(new URL("../tests/fixtures/frontend-baseline.json", import.meta.url), "utf8"));
  const schemas = {};
  const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
  function infer(value) {
    if (value === null) return { type: "null" };
    if (Array.isArray(value)) {
      const variants = [...new Map(value.map((item) => { const schema = infer(item); return [JSON.stringify(schema), schema]; })).values()];
      return { type: "array", items: variants.length > 1 ? { anyOf: variants } : variants[0] ?? {} };
    }
    if (typeof value === "object") return { type: "object", properties: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, ["review", "question"].includes(key) ? { anyOf: [infer(item), { type: "null" }] } : infer(item)])), required: Object.keys(value) };
    return { type: typeof value === "number" ? "number" : typeof value };
  }
  const packets = {};
  for (const [slug, data] of Object.entries(baseline.personas)) {
    const props = {};
    for (const [key, value] of Object.entries(data)) { const name = `${slug}_${key}`; schemas[name] = infer(value); props[key] = ref(name); }
    schemas[slug] = { type: "object", properties: props, required: Object.keys(props) };
    packets[slug] = props;
  }
  const object = (properties, required = Object.keys(properties)) => ({ type: "object", additionalProperties: false, properties, required });
  const string = { type: "string" }, integer = { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER }, bool = { type: "boolean" };
  const array = (items) => ({ type: "array", items });
  const enumOf = (...values) => ({ type: "string", enum: values });
  schemas.Error = object({ error: object({ code: string, message: string }) });
  const full = { anyOf: [ref("pf"), ref("student")] };
  const paths = {};
  const add = (method, path, response = full, body, status = "200") => {
    const parameters = [...path.matchAll(/\{(\w+)\}/g)].map((match) => ({ in: "path", name: match[1], required: true, schema: match[1] === "persona" ? enumOf("pf", "student") : string }));
    paths[path] ??= {};
    paths[path][method] = { operationId: `${method}_${path.replace(/[^a-zA-Z0-9]+/g, "_")}`, parameters,
      ...(body ? { requestBody: { required: true, content: { "application/json": { schema: body } } } } : {}),
      responses: { [status]: { description: status === "204" ? "Coach data deleted" : "Success", ...(status === "204" ? {} : { content: { "application/json": { schema: response } } }) },
        ...Object.fromEntries([400, 404, 409, 410, 413, 500].map((code) => [String(code), { description: "Safe error", content: { "application/json": { schema: ref("Error") } } }])) } };
  };
  add("get", "/accounts", infer(baseline.accounts));
  add("get", "/catalog", { type: "object" });
  add("get", "/openapi.json", { type: "object" });
  const root = "/personas/{persona}";
  add("get", root);
  add("get", `${root}/preferences`, { type: "object" });
  add("get", `${root}/metrics`, { type: "object" });
  for (const [screen, fields] of Object.entries(SCREEN_FIELDS)) {
    const response = screen === "products" ? object({ client: ref("pf_client"), entry: ref("pf_entry"), products: ref("pf_products") }) : { anyOf: Object.entries(packets).map(([, props]) => {
      const selected = Object.fromEntries(fields.filter((key) => key in props).map((key) => [key, props[key]]));
      return { type: "object", properties: selected, required: Object.keys(selected) };
    }) };
    add("get", `${root}/${screen}`, response);
  }
  paths[`${root}/tracking`].get.parameters.push({ in: "query", name: "q", schema: { type: "string", maxLength: 160 } }, { in: "query", name: "filter", schema: enumOf("all", "expenses", "income", "uncategorized", "recurring") });
  add("get", `${root}/transactions/{id}`, { type: "object" });
  add("patch", `${root}/transactions/{id}`, full, object({ name: string, category: string, note: string, tags: array(string), rule: bool, excluded: bool }, []));
  add("post", `${root}/transactions/{id}/splits`, full, object({ parts: array(object({ category: string, amount_minor: integer })) }));
  const document = object({ name: string, mime: string, content_base64: { type: "string", contentEncoding: "base64" } });
  add("post", `${root}/transactions/{id}/receipt`, full, document);
  add("post", `${root}/statements`, full, document);
  add("post", `${root}/imports`, full, object({ period: string }));
  add("post", `${root}/categories`, full, object({ label: string }));
  const budget = object({ category: string, name: string, kind: enumOf("amount", "count"), limit_minor: integer, count_limit: { type: "integer", minimum: 1, maximum: 100 }, period: enumOf("week", "cycle") }, []);
  add("post", `${root}/budgets`, full, budget); add("patch", `${root}/budgets/{id}`, full, budget);
  add("patch", `${root}/profile/{section}`, full, object({ items: array(object({ label: string, value: string })) }));
  add("patch", `${root}/preferences`, full, object({ permissions: { type: "object", additionalProperties: bool }, privacy: { type: "object", additionalProperties: bool }, services_on: bool }, []));
  add("patch", `${root}/calendar`, full, object({ connected: { type: ["string", "null"], enum: ["google", "phone", null] }, gift_choices: array(string) }, []));
  add("patch", `${root}/apps/{name}`, full, object({ on: bool }));
  add("put", `${root}/answers/{question}`, full, object({ selected: array(string), fields: { type: "object", additionalProperties: string } }));
  add("patch", `${root}/services/{id}`, full, object({ action: string }));
  add("post", `${root}/ideas/decision`, full, object({ decision: enumOf("accepted", "dismissed") }));
  add("post", `${root}/chat/messages`, full, object({ text: { type: "string", minLength: 1, maxLength: 4000 } }));
  add("post", `${root}/chat/{index}/decision`, full, object({ action: string }));
  add("post", `${root}/coach`, full, object({}, [])); add("delete", `${root}/coach`, undefined, undefined, "204");
  for (const methods of Object.values(paths)) for (const [method, operation] of Object.entries(methods)) if (!["get", "delete"].includes(method)) operation.parameters.push({ in: "header", name: "Idempotency-Key", schema: string }, { in: "header", name: "If-Match", schema: string });
  return { openapi: "3.1.0", info: { title: "Busola Personal Demo API", version: "1.0.0", description: "Demo local Daria/Matei. Date fictive, fără autentificare reală. Formele și valorile în lei ale frontend-ului sunt păstrate; DB și calculele folosesc exclusiv bani întregi. DEMO_TODAY este ziua de referință." }, servers: [{ url: "/api/demo/v1" }], paths, components: { schemas } };
}

export async function exportOpenApi() {
  const text = JSON.stringify(await buildOpenApi(), null, 2) + "\n";
  await writeFile(new URL("../openapi.json", import.meta.url), text);
  await writeFile(new URL("../../api/node-openapi.yaml", import.meta.url), text);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await exportOpenApi();
