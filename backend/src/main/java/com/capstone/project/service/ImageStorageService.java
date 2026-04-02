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
 *
 * The @PostConstruct only VERIFIES the bucket exists — it never tries to
 * create it. The IAM policy for crop-health-user explicitly denies
 * s3:CreateBucket, and the bucket already exists in ap-south-1.
 */
@Service
public class ImageStorageService {

    private static final Logger log = LoggerFactory.getLogger(ImageStorageService.class);

    private static final Set<String> ALLOWED_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    private static final long        MAX_SIZE_BYTES = 5 * 1024 * 1024L; // 5 MB

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
        // Just verify the bucket is reachable — never try to create it.
        // The bucket is pre-created in AWS console; the IAM user only needs
        // s3:HeadBucket, s3:PutObject, s3:GetObject, s3:DeleteObject, s3:ListBucket.
        try {
            s3Client.headBucket(HeadBucketRequest.builder().bucket(bucketName).build());
            log.info("✅ S3 bucket '{}' is ready in region {}", bucketName, region);
        } catch (NoSuchBucketException ex) {
            log.error("❌ S3 bucket '{}' does not exist — create it in the AWS console in region {}",
                    bucketName, region);
        } catch (S3Exception ex) {
            if (ex.statusCode() == 403) {
                // 403 on HeadBucket can mean the bucket EXISTS but the IAM user
                // lacks s3:ListBucket. Uploads may still work — log a warning only.
                log.warn("⚠ S3 bucket '{}' exists but HeadBucket returned 403. " +
                        "Add s3:ListBucket to the IAM policy if listing is needed. " +
                        "Uploads will still work if s3:PutObject is granted.", bucketName);
            } else {
                log.warn("⚠ Could not verify S3 bucket '{}': {} (status={}). " +
                        "Uploads may fail.", bucketName, ex.getMessage(), ex.statusCode());
            }
        } catch (Exception ex) {
            log.warn("⚠ Could not verify S3 bucket '{}': {}. Uploads may fail.",
                    bucketName, ex.getMessage());
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
        return originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");
    }
}