package com.paul.paul_backend.service;

import com.paul.paul_backend.model.User;
import com.paul.paul_backend.model.UserRole;
import com.paul.paul_backend.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder encoder;

    private static final String CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final int CODE_LENGTH = 8;
    private final SecureRandom random = new SecureRandom();

    public AuthService(UserRepository userRepository, PasswordEncoder encoder) {
        this.userRepository = userRepository;
        this.encoder = encoder;
    }

    public User register(User user) {
        if (userRepository.findByEmail(user.getEmail()).isPresent()) {
            throw new IllegalArgumentException("Email already exists");
        }

        String userCode;
        do {
            userCode = generateUserCode();
        } while (userRepository.findByUserCode(userCode).isPresent());

        user.setPassword(encoder.encode(user.getPassword()));
        user.setUserCode(userCode);

        if (user.getRole() == null) {
            user.setRole(UserRole.USER);
        }

        return userRepository.save(user);
    }

    public User login(String email, String rawPassword) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("Invalid email or password"));

        if (!encoder.matches(rawPassword, user.getPassword())) {
            throw new IllegalArgumentException("Invalid email or password");
        }

        return user;
    }

    public User getUserById(String userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    public User updateName(String userId, String name) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (name == null || name.trim().isEmpty()) {
            throw new IllegalArgumentException("Name is required");
        }

        user.setName(name.trim());
        return userRepository.save(user);
    }

    public void changePassword(String userId, String currentPassword, String newPassword, String confirmPassword) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        if (currentPassword == null || currentPassword.isBlank()) {
            throw new IllegalArgumentException("Current password is required");
        }

        if (!encoder.matches(currentPassword, user.getPassword())) {
            throw new IllegalArgumentException("Current password is incorrect");
        }

        if (newPassword == null || newPassword.length() < 6) {
            throw new IllegalArgumentException("New password must be at least 6 characters");
        }

        if (!newPassword.equals(confirmPassword)) {
            throw new IllegalArgumentException("New passwords do not match");
        }

        user.setPassword(encoder.encode(newPassword));
        userRepository.save(user);
    }

    private String generateUserCode() {
        StringBuilder code = new StringBuilder(CODE_LENGTH);

        for (int i = 0; i < CODE_LENGTH; i++) {
            int index = random.nextInt(CHARACTERS.length());
            code.append(CHARACTERS.charAt(index));
        }

        return code.toString();
    }
}