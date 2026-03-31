package com.capstone.project.service;

import com.capstone.project.dto.*;
import com.capstone.project.exception.ApiException;
import com.capstone.project.model.User;
import com.capstone.project.model.VerificationToken;
import com.capstone.project.repository.*;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.Date;

/**
 * Auth business logic — fully extracted from controller.
 * - Uses ApiException for all error paths (no raw RuntimeException).
 * - OTP uses SecureRandom instead of Math.random().
 * - Email is sent async (won't block the response).
 * - @Transactional on write operations.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository         userRepository;
    private final JwtService             jwtService;
    private final VerificationTokenRepository tokenRepo;
    private final EmailService           emailService;
    private final BCryptPasswordEncoder  encoder = new BCryptPasswordEncoder();

    public AuthService(UserRepository userRepository,
                       JwtService jwtService,
                       VerificationTokenRepository tokenRepo,
                       EmailService emailService) {
        this.userRepository = userRepository;
        this.jwtService     = jwtService;
        this.tokenRepo      = tokenRepo;
        this.emailService   = emailService;
    }

    // ── REGISTER ─────────────────────────────────────────────

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw ApiException.conflict("Email is already registered.");
        }

        User user = new User();
        user.setEmail(req.getEmail().toLowerCase().trim());
        user.setName(req.getName().trim());
        user.setPasswordHash(encoder.encode(req.getPassword()));
        user.setVerified(false);
        userRepository.save(user);

        String otp = generateOtp();
        saveOtp(user.getId(), otp);

        // Fire-and-forget — does not block response
        emailService.sendVerificationEmail(user.getEmail(), otp);
        log.info("User registered: {}", user.getEmail());

        return new AuthResponse(null, "OTP sent to your email.");
    }

    // ── LOGIN ─────────────────────────────────────────────────

public AuthResponse login(LoginRequest req) {
    User user = userRepository.findByEmail(req.getEmail().toLowerCase().trim())
            .orElseThrow(() -> ApiException.unauthorized("Invalid email or password."));

    if (!encoder.matches(req.getPassword(), user.getPasswordHash())) {
        throw ApiException.unauthorized("Invalid password.");
    }

    if (!user.isVerified()) {
        throw ApiException.unauthorized("Please verify your email before logging in.");
    }

    String token = jwtService.generate(user.getId(), user.getEmail());
    return new AuthResponse(toDto(user), token);
}

    // ── VERIFY OTP ────────────────────────────────────────────

    @Transactional
    public AuthResponse verifyOtp(String email, String otp) {
        User user = userRepository.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> ApiException.notFound("User not found."));

        VerificationToken vt = tokenRepo.findByUserId(user.getId())
                .orElseThrow(() -> ApiException.badRequest("No OTP found. Please request a new one."));

        if (vt.getExpiryDate().before(new Date())) {
            throw ApiException.badRequest("OTP has expired. Please request a new one.");
        }

        if (!vt.getOtp().equals(otp)) {
            throw ApiException.badRequest("Invalid OTP.");
        }

        user.setVerified(true);
        userRepository.save(user);
        tokenRepo.delete(vt);

        String token = jwtService.generate(user.getId(), user.getEmail());
        log.info("User verified: {}", user.getEmail());
        return new AuthResponse(toDto(user), token);
    }

    // ── RESEND OTP ────────────────────────────────────────────

    @Transactional
    public String resendOtp(String email) {
        User user = userRepository.findByEmail(email.toLowerCase().trim())
                .orElseThrow(() -> ApiException.notFound("User not found."));

        if (user.isVerified()) {
            throw ApiException.badRequest("Account is already verified.");
        }

        String otp = generateOtp();
        saveOtp(user.getId(), otp);
        emailService.sendVerificationEmail(user.getEmail(), otp);
        log.info("OTP resent to: {}", user.getEmail());
        return "OTP resent to your email.";
    }

    // ── HELPERS ───────────────────────────────────────────────

    private String generateOtp() {
        return String.format("%06d", SECURE_RANDOM.nextInt(1_000_000));
    }

    private void saveOtp(Long userId, String otp) {
        // Upsert: delete old token if exists, then save fresh one
        tokenRepo.deleteByUserId(userId);
        VerificationToken vt = new VerificationToken();
        vt.setUserId(userId);
        vt.setOtp(otp);
        vt.setExpiryDate(new Date(System.currentTimeMillis() + 5 * 60 * 1000L));
        tokenRepo.save(vt);
    }

    private AuthResponse.UserDto toDto(User user) {
        AuthResponse.UserDto dto = new AuthResponse.UserDto();
        dto.id    = user.getId();
        dto.name  = user.getName();
        dto.email = user.getEmail();
        return dto;
    }
}
