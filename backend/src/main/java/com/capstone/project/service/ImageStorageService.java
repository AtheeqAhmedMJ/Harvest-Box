package com.capstone.project.service;

import com.capstone.project.exception.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.util.Set;
import java.util.UUID;

/**
 * S3 image storage with input validation.
 * - Validates MIME type and file size before uploading.
 * - Bucket name is config-driven (no hardcoded string).
 * - User-scoped keys: uploads/{userId}/{uuid}_{originalName}
 */
@Service
public class ImageStorageService {

    private static final Logger log = LoggerFactory.getLogger(ImageStorageService.class);

    private static final Set<String> ALLOWED_TYPES   = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long        MAX_SIZE_BYTES   = 5 * 1024 * 1024L; // 5 MB

    private final S3Client s3Client;

    @Value("${aws.s3.bucket}")
    private String bucketName;

    @Value("${aws.region:ap-south-1}")
    private String region;

    public ImageStorageService(S3Client s3Client) {
        this.s3Client = s3Client;
    }

    @PostConstruct
    public void initializeBucket() {
        try {
            if (!isBucketExists()) {
                createBucket();
            }
            log.info("✅ S3 bucket '{}' is ready", bucketName);
        } catch (Exception ex) {
            log.warn("⚠ Failed to initialize S3 bucket: {}. Images may fail to upload.", ex.getMessage());
        }
    }

    private boolean isBucketExists() {
        try {
            HeadBucketRequest headRequest = HeadBucketRequest.builder().bucket(bucketName).build();
            s3Client.headBucket(headRequest);
            return true;
        } catch (NoSuchBucketException ex) {
            return false;
        } catch (Exception ex) {
            log.warn("Error checking bucket existence: {}", ex.getMessage());
            return false;
        }
    }

    private void createBucket() {
        try {
            CreateBucketRequest createRequest = CreateBucketRequest.builder()
                    .bucket(bucketName)
                    .build();
            s3Client.createBucket(createRequest);
            log.info("Created S3 bucket: {}", bucketName);
        } catch (BucketAlreadyOwnedByYouException ex) {
            log.info("Bucket already exists and is owned by you: {}", bucketName);
        } catch (Exception ex) {
            log.error("Failed to create S3 bucket: {}", ex.getMessage());
            throw ex;
        }
    }

    public String save(MultipartFile file, Long userId) throws IOException {
        validateFile(file);

        String safeFilename = sanitizeFilename(file.getOriginalFilename());
        String key = "uploads/" + userId + "/" + UUID.randomUUID() + "_" + safeFilename;

        try {
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .contentType(file.getContentType())
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromBytes(file.getBytes()));

            String url = "https://" + bucketName + ".s3." + region + ".amazonaws.com/" + key;
            log.info("Uploaded image for userId={} key={}", userId, key);
            return url;
        } catch (NoSuchBucketException ex) {
            log.error("S3 bucket '{}' does not exist", bucketName);
            throw ApiException.internalServerError("Image storage is not configured. Please contact support.");
        } catch (Exception ex) {
            log.error("Failed to upload image: {}", ex.getMessage());
            throw ApiException.internalServerError("Image upload failed. Please try again later.");
        }
    }

    private void validateFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("File must not be empty.");
        }
        if (file.getSize() > MAX_SIZE_BYTES) {
            throw ApiException.badRequest("File size exceeds 5 MB limit.");
        }
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType.toLowerCase())) {
            throw ApiException.badRequest("Only JPEG, PNG and WEBP images are allowed.");
        }
    }

    private String sanitizeFilename(String originalFilename) {
        if (originalFilename == null || originalFilename.isBlank()) return "image";
        // Strip path traversal and keep only safe characters
        return originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}
