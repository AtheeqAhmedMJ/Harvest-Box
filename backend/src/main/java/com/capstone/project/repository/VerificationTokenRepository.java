package com.capstone.project.repository;

import com.capstone.project.model.VerificationToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VerificationTokenRepository extends JpaRepository<VerificationToken, Long> {

    Optional<VerificationToken> findByUserId(Long userId);

    void deleteByUserId(Long userId); 
}