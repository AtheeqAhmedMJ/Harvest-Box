package com.capstone.project;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

@SpringBootTest
@ActiveProfiles("dev")
@TestPropertySource(properties = {
    "AWS_ACCESS_KEY_ID=dummy",
    "AWS_SECRET_ACCESS_KEY=dummy",
    "MAIL_USERNAME=dummy@example.com",
    "MAIL_PASSWORD=dummy",
    "JWT_SECRET=dummysecret"
})
class ProjectApplicationTests {

    @Test
    void contextLoads() {
        // Verifies the Spring context starts without errors
    }
}
