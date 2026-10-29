package ro.greenstruct.agro.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartException;

import ro.greenstruct.agro.external.UpstreamUnavailableException;
import ro.greenstruct.agro.farm.FarmNotFoundException;
import ro.greenstruct.agro.orchestration.RunNotFoundException;
import ro.greenstruct.agro.orchestration.RunRejectedException;

/** Errors in the contract format { "error": { "code", "message" } } with the codes of contracts/openapi.yaml. */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    public record ApiError(Error error) {
        public record Error(String code, String message) {
        }
    }

    @ExceptionHandler({NotFoundException.class, RunNotFoundException.class, FarmNotFoundException.class})
    public ResponseEntity<ApiError> notFound(RuntimeException e) {
        return error(HttpStatus.NOT_FOUND, "NOT_FOUND", e.getMessage());
    }

    @ExceptionHandler(RunRejectedException.class)
    public ResponseEntity<ApiError> rejected(RunRejectedException e) {
        return switch (e.reason()) {
            case FARM_NOT_FOUND -> error(HttpStatus.NOT_FOUND, "NOT_FOUND", e.getMessage());
            case MODULE_NOT_READY -> error(HttpStatus.UNPROCESSABLE_ENTITY, "MODULE_NOT_READY", e.getMessage());
        };
    }

    @ExceptionHandler(UpstreamUnavailableException.class)
    public ResponseEntity<ApiError> upstream(UpstreamUnavailableException e) {
        log.warn("Upstream unavailable: {}", e.getMessage(), e.getCause());
        return error(HttpStatus.BAD_GATEWAY, "UPSTREAM_UNAVAILABLE", e.getMessage());
    }

    @ExceptionHandler({IllegalArgumentException.class, MissingServletRequestParameterException.class,
            HttpMessageNotReadableException.class})
    public ResponseEntity<ApiError> badRequest(Exception e) {
        String message = e instanceof HttpMessageNotReadableException ? "The request body is not valid JSON" : e.getMessage();
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", message);
    }

    @ExceptionHandler(UploadedFileType.UnsupportedFileTypeException.class)
    public ResponseEntity<ApiError> unsupportedFile(UploadedFileType.UnsupportedFileTypeException e) {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "UNSUPPORTED_FILE_TYPE", e.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ApiError> conflict(IllegalStateException e) {
        return error(HttpStatus.CONFLICT, "INVALID_STATE", e.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiError> tooLarge(MaxUploadSizeExceededException e) {
        return error(HttpStatus.PAYLOAD_TOO_LARGE, "FILE_TOO_LARGE", "The documents exceed the maximum allowed size");
    }

    @ExceptionHandler(MultipartException.class)
    public ResponseEntity<ApiError> notMultipart(MultipartException e) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "The request must be sent as multipart/form-data");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> internal(Exception e) {
        log.error("Unhandled API error", e);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL", "An error occurred. Try again.");
    }

    private static ResponseEntity<ApiError> error(HttpStatus status, String code, String message) {
        String text = message == null ? status.getReasonPhrase() : message;
        return ResponseEntity.status(status)
                .body(new ApiError(new ApiError.Error(code, text.length() > 300 ? text.substring(0, 300) : text)));
    }
}
