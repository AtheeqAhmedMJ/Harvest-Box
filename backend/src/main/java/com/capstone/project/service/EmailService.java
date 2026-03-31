package com.capstone.project.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * Email sending is @Async — it never blocks the HTTP request thread.
 * If mail fails, it logs an error but does not crash the registration flow.
 */
@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    @Async
    public void sendVerificationEmail(String to, String otp) {
        try {
            SimpleMailMessage mail = new SimpleMailMessage();
            mail.setTo(to);
            mail.setSubject("Your Harvest Box Verification Code");
            mail.setText(
                "Hello,\n\n"
                + "Your verification code is: " + otp + "\n\n"
                + "This code expires in 5 minutes.\n\n"
                + "If you did not request this, please ignore this email.\n\n"
                + "—Team Harvest Box"
            );
            mailSender.send(mail);
            log.info("Verification email sent to {}", to);
        } catch (Exception e) {
            log.error("Failed to send verification email to {}: {}", to, e.getMessage());
        }
    }
}
