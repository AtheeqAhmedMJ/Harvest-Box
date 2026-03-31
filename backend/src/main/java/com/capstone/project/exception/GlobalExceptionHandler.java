package com.capstone.project.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.*;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.time.Instant;
import java.util.*;

/**
 * Centralised error handler — all exceptions bubble here.
 * Frontend always receives a consistent JSON error envelope:
 *   { "timestamp", "status", "error", "message", "path" }
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // ── Our own domain exception ──────────────────────────────
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApiException(
            ApiException ex, HttpServletRequest req) {

        log.warn("ApiException [{}] on {}: {}", ex.getStatus(), req.getRequestURI(), ex.getMessage());
        return build(ex.getStatus(), ex.getMessage(), req.getRequestURI());
    }

    // ── @Valid failures ───────────────────────────────────────
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest req) {

        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fe.getField(), fe.getDefaultMessage());
        }
        String message = "Validation failed: " + fieldErrors;
        log.warn("Validation error on {}: {}", req.getRequestURI(), message);
        return build(HttpStatus.BAD_REQUEST, message, req.getRequestURI());
    }

    // ── Bean Validation (path/query params) ──────────────────
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(
            ConstraintViolationException ex, HttpServletRequest req) {

        return build(HttpStatus.BAD_REQUEST, ex.getMessage(), req.getRequestURI());
    }

    // ── File too large ────────────────────────────────────────
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSize(
            MaxUploadSizeExceededException ex, HttpServletRequest req) {

        return build(HttpStatus.PAYLOAD_TOO_LARGE, "File size exceeds the allowed limit.", req.getRequestURI());
    }

    // ── Spring Security authentication failures ───────────────
    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ErrorResponse> handleAuthenticationException(
            AuthenticationException ex, HttpServletRequest req) {

        log.warn("AuthenticationException on {}: {}", req.getRequestURI(), ex.getMessage());
        return build(HttpStatus.UNAUTHORIZED, "Unauthorized: " + ex.getMessage(), req.getRequestURI());
    }

    // ── AWS S3 configuration issues ───────────────────────────
    @ExceptionHandler(NoSuchBucketException.class)
    public ResponseEntity<ErrorResponse> handleNoSuchBucket(
            NoSuchBucketException ex, HttpServletRequest req) {

        log.error("S3 bucket configuration error on {}: {}", req.getRequestURI(), ex.getMessage());
        return build(HttpStatus.INTERNAL_SERVER_ERROR, 
                "Image storage service is not properly configured. Please contact support.", 
                req.getRequestURI());
    }

    // ── AWS S3 general errors ────────────────────────────────
    @ExceptionHandler(S3Exception.class)
    public ResponseEntity<ErrorResponse> handleS3Exception(
            S3Exception ex, HttpServletRequest req) {

        log.error("S3 error [{}] on {}: {}", ex.statusCode(), req.getRequestURI(), ex.getMessage());
        return build(HttpStatus.INTERNAL_SERVER_ERROR, 
                "Image upload failed. Please try again later.", 
                req.getRequestURI());
    }

    // ── External service HTTP errors ─────────────────────────
    @ExceptionHandler(HttpClientErrorException.class)
    public ResponseEntity<ErrorResponse> handleHttpClientError(
            HttpClientErrorException ex, HttpServletRequest req) {

        log.error("External service client error [{}] on {}: {}", ex.getStatusCode(), req.getRequestURI(), ex.getMessage());
        HttpStatus status = HttpStatus.valueOf(ex.getStatusCode().value());
        return build(status, 
                "External service error: " + ex.getStatusText(), 
                req.getRequestURI());
    }

    @ExceptionHandler(HttpServerErrorException.class)
    public ResponseEntity<ErrorResponse> handleHttpServerError(
            HttpServerErrorException ex, HttpServletRequest req) {

        log.error("External service server error [{}] on {}: {}", ex.getStatusCode(), req.getRequestURI(), ex.getMessage());
        return build(HttpStatus.INTERNAL_SERVER_ERROR, 
                "External service is temporarily unavailable.", 
                req.getRequestURI());
    }

    // ── Catch-all — don't leak stack traces to clients ────────
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleAll(Exception ex, HttpServletRequest req) {
        log.error("Unhandled exception on {}", req.getRequestURI(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.", req.getRequestURI());
    }

    // ── Builder helper ────────────────────────────────────────
    private ResponseEntity<ErrorResponse> build(HttpStatus status, String message, String path) {
        ErrorResponse body = new ErrorResponse(
                Instant.now().toString(),
                status.value(),
                status.getReasonPhrase(),
                message,
                path
        );
        return ResponseEntity.status(status).body(body);
    }

    // ── Error envelope DTO ────────────────────────────────────
    public record ErrorResponse(
            String timestamp,
            int    status,
            String error,
            String message,
            String path
    ) {}
}
