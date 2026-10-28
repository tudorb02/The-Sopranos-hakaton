from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from app.api.routes import router
from app.api.schemas import HealthResponse
from app.services.analytics_service import NotFoundError

app = FastAPI(
    title="Nexxt Finance API",
    version="1.0.0",
    description=(
        "Analiză financiară deterministă. X-User-Id este exclusiv pentru dezvoltare. "
        "Sumele sunt întregi în bani; cheltuielile sunt negative. Datele sunt UTC."
    ),
)
app.include_router(router)


def error(status: int, code: str, message: str):
    return JSONResponse(status_code=status, content={"error": {"code": code, "message": message}})


@app.exception_handler(HTTPException)
async def http_error(request: Request, exc: HTTPException):
    return error(exc.status_code, f"http_{exc.status_code}", str(exc.detail))


@app.exception_handler(NotFoundError)
async def not_found(request: Request, exc: NotFoundError):
    return error(404, "not_found", str(exc))


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError):
    # Do not echo validation input: multipart bodies can contain bank data.
    return error(422, "validation_error", "Cerere invalidă. Verifică parametrii și câmpurile obligatorii.")


@app.exception_handler(ValueError)
async def value_error(request: Request, exc: ValueError):
    return error(400, "invalid_request", "Datele cererii sunt invalide.")


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    return error(500, "internal_error", "Eroare internă la procesarea cererii.")


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health():
    return {"status": "ok"}
