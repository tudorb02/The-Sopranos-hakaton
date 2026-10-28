import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildOpenApi } from "../scripts/export-openapi.js";
import { createApp } from "../src/app.js";
import { request, test } from "./runtime.js";

test("the exported Node contract matches its source and the served copy", async () => {
  const actual = await buildOpenApi();
  assert.deepEqual(
    JSON.parse(await readFile(new URL("../../api/node-openapi.yaml", import.meta.url), "utf8")),
    actual,
  );
  const served = await request(createApp({})).get("/api/demo/v1/openapi.json");
  assert.equal(served.status, 200);
  assert.deepEqual(served.body, actual);
});

test("every implemented API operation has a matching contract entry", async () => {
  const app = createApp({});
  const router = app.router.stack.find((layer) => layer.handle.stack).handle;
  const implemented = router.stack
    .filter((layer) => layer.route)
    .flatMap((layer) =>
      Object.keys(layer.route.methods).map(
        (method) => `${method} ${layer.route.path.replace(/:(\w+)/g, "{$1}")}`,
      ),
    )
    .sort();
  const specification = await buildOpenApi();
  const documented = Object.entries(specification.paths)
    .flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method} ${path}`))
    .sort();
  assert.deepEqual(implemented, documented);
});
