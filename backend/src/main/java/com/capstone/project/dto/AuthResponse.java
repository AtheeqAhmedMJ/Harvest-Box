package com.capstone.project.dto;

public class AuthResponse {

    public UserDto user;
    public String token;

    public AuthResponse(UserDto user, String token) {
        this.user = user;
        this.token = token;
    }

    public static class UserDto {
        public Long id;
        public String name;
        public String email;
    }
}