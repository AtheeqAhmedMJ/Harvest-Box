package com.capstone.project.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.EnvironmentVariableCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
public class S3Config {

    @Value("${aws.credentials.access-key:}")
    private String accessKey;

    @Value("${aws.credentials.secret-key:}")
    private String secretKey;

    @Value("${aws.region}")
    private String region;

    @Bean
    public S3Client s3Client() {

        AwsCredentialsProvider credentialsProvider;

        // ✅ Prefer ENV variables
        if (System.getenv("AWS_ACCESS_KEY_ID") != null &&
            System.getenv("AWS_SECRET_ACCESS_KEY") != null) {

            credentialsProvider = EnvironmentVariableCredentialsProvider.create();
            System.out.println("Using ENV credentials");

        } else {
            // fallback (if env not present)
            credentialsProvider = StaticCredentialsProvider.create(
                    AwsBasicCredentials.create(accessKey, secretKey)
            );
            System.out.println("Using application.yml credentials");
        }

        System.out.println("S3 Region = " + region);
        

        return S3Client.builder()
                .region(Region.of(region)) // ✅ CRITICAL
                .credentialsProvider(credentialsProvider)
                .build();
                
    }
    
}