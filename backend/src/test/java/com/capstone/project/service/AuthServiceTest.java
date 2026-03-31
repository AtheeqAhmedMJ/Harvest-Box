package com.capstone.project.service;

import com.capstone.project.dto.AuthResponse;
import com.capstone.project.dto.LoginRequest;
import com.capstone.project.dto.RegisterRequest;
import com.capstone.project.exception.ApiException;
import com.capstone.project.model.User;
import com.capstone.project.model.VerificationToken;
import com.capstone.project.repository.UserRepository;
import com.capstone.project.repository.VerificationTokenRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

import java.util.Date;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService Unit Tests")
class AuthServiceTest {

    @Mock UserRepository              userRepository;
    @Mock JwtService                  jwtService;
    @Mock VerificationTokenRepository tokenRepo;
    @Mock EmailService                emailService;

    @InjectMocks AuthService authService;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();

    // ── register ─────────────────────────────────────────────

    @Test
    @DisplayName("register: success — saves user and returns OTP sent message")
    void register_success() {
        RegisterRequest req = new RegisterRequest();
        req.setName("Alice");
        req.setEmail("alice@example.com");
        req.setPassword("password123");

        when(userRepository.existsByEmail(anyString())).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(inv -> {
            User u = inv.getArgument(0);
            // simulate DB assigning id
            return u;
        });

        AuthResponse response = authService.register(req);

        assertThat(response.token).contains("OTP");
        verify(userRepository).save(any(User.class));
        verify(emailService).sendVerificationEmail(anyString(), anyString());
    }

    @Test
    @DisplayName("register: duplicate email throws 409 conflict")
    void register_duplicateEmail_throws() {
        RegisterRequest req = new RegisterRequest();
        req.setEmail("dup@example.com");
        req.setPassword("password123");
        req.setName("Dup");

        when(userRepository.existsByEmail("dup@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authService.register(req))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("already registered");
    }

    // ── login ─────────────────────────────────────────────────

    @Test
    @DisplayName("login: success returns JWT token")
    void login_success() {
        User user = verifiedUser("bob@example.com", "secret");
        LoginRequest req = loginRequest("bob@example.com", "secret");

        when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(user));
        when(jwtService.generate(any(), anyString())).thenReturn("jwt-token");

        AuthResponse response = authService.login(req);

        assertThat(response.token).isEqualTo("jwt-token");
    }

    @Test
    @DisplayName("login: wrong password throws 401")
    void login_wrongPassword_throws() {
        User user = verifiedUser("bob@example.com", "secret");
        LoginRequest req = loginRequest("bob@example.com", "wrong");

        when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid");
    }

    @Test
    @DisplayName("login: unverified user throws 401")
    void login_unverifiedUser_throws() {
        User user = verifiedUser("bob@example.com", "secret");
        user.setVerified(false);
        LoginRequest req = loginRequest("bob@example.com", "secret");

        when(userRepository.findByEmail("bob@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authService.login(req))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("verify");
    }

    // ── verifyOtp ─────────────────────────────────────────────

    @Test
    @DisplayName("verifyOtp: valid OTP verifies user and returns token")
    void verifyOtp_success() {
        User user = unverifiedUser("carol@example.com");
        when(userRepository.findByEmail("carol@example.com")).thenReturn(Optional.of(user));

        VerificationToken vt = new VerificationToken();
        vt.setOtp("123456");
        vt.setExpiryDate(new Date(System.currentTimeMillis() + 60_000));
        when(tokenRepo.findByUserId(user.getId())).thenReturn(Optional.of(vt));
        when(jwtService.generate(any(), anyString())).thenReturn("jwt-token");

        AuthResponse response = authService.verifyOtp("carol@example.com", "123456");

        assertThat(response.token).isEqualTo("jwt-token");
        verify(userRepository).save(user);
        verify(tokenRepo).delete(vt);
    }

    @Test
    @DisplayName("verifyOtp: expired OTP throws 400")
    void verifyOtp_expired_throws() {
        User user = unverifiedUser("dave@example.com");
        when(userRepository.findByEmail("dave@example.com")).thenReturn(Optional.of(user));

        VerificationToken vt = new VerificationToken();
        vt.setOtp("123456");
        vt.setExpiryDate(new Date(System.currentTimeMillis() - 1000)); // expired
        when(tokenRepo.findByUserId(user.getId())).thenReturn(Optional.of(vt));

        assertThatThrownBy(() -> authService.verifyOtp("dave@example.com", "123456"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("expired");
    }

    @Test
    @DisplayName("verifyOtp: wrong OTP throws 400")
    void verifyOtp_wrongOtp_throws() {
        User user = unverifiedUser("eve@example.com");
        when(userRepository.findByEmail("eve@example.com")).thenReturn(Optional.of(user));

        VerificationToken vt = new VerificationToken();
        vt.setOtp("111111");
        vt.setExpiryDate(new Date(System.currentTimeMillis() + 60_000));
        when(tokenRepo.findByUserId(user.getId())).thenReturn(Optional.of(vt));

        assertThatThrownBy(() -> authService.verifyOtp("eve@example.com", "999999"))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid OTP");
    }

    // ── helpers ───────────────────────────────────────────────

    private User verifiedUser(String email, String rawPassword) {
        User u = new User();
        u.setEmail(email);
        u.setName("Test");
        u.setPasswordHash(encoder.encode(rawPassword));
        u.setVerified(true);
        return u;
    }

    private User unverifiedUser(String email) {
        User u = new User();
        u.setEmail(email);
        u.setName("Test");
        u.setPasswordHash(encoder.encode("pass"));
        u.setVerified(false);
        return u;
    }

    private LoginRequest loginRequest(String email, String password) {
        LoginRequest r = new LoginRequest();
        r.setEmail(email);
        r.setPassword(password);
        return r;
    }
}
