package com.capstone.project.model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(
    name = "verification_tokens",
    indexes = {
        @Index(name = "idx_vt_user_id", columnList = "userId")
    }
)
public class VerificationToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String otp;

    @Column(nullable = false)
    private Long userId;

    @Column(nullable = false)
    private Date expiryDate;

    // ── Getters & Setters ────────────────────────────────────

    public Long   getId()                       { return id; }

    public String getOtp()                      { return otp; }
    public void   setOtp(String otp)            { this.otp = otp; }

    public Long   getUserId()                   { return userId; }
    public void   setUserId(Long userId)        { this.userId = userId; }

    public Date   getExpiryDate()               { return expiryDate; }
    public void   setExpiryDate(Date expiryDate){ this.expiryDate = expiryDate; }
}
