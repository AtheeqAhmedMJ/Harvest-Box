package com.capstone.project.exception;

import org.springframework.http.HttpStatus;

/**
 * Base runtime exception that carries an HTTP status.
 * Throw this (or its subclasses) from any service layer — the
 * GlobalExceptionHandler will map it to the right HTTP response.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;

    public ApiException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    // ── common factory helpers ────────────────────────────────

    public static ApiException notFound(String message) {
        return new ApiException(message, HttpStatus.NOT_FOUND);
    }

    public static ApiException badRequest(String message) {
        return new ApiException(message, HttpStatus.BAD_REQUEST);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(message, HttpStatus.UNAUTHORIZED);
    }

    public static ApiException conflict(String message) {
        return new ApiException(message, HttpStatus.CONFLICT);
    }

    public static ApiException internalServerError(String message) {
        return new ApiException(message, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    public static ApiException unprocessableEntity(String message) {
        return new ApiException(message, HttpStatus.UNPROCESSABLE_ENTITY);
    }
}
