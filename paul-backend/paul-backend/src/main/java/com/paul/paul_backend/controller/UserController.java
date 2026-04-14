package com.paul.paul_backend.controller;

import com.paul.paul_backend.model.User;
import com.paul.paul_backend.security.AuthUtil;
import com.paul.paul_backend.service.AuthService;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final AuthService authService;

    @GetMapping("/me")
    public UserProfileResponse getMe() {
        String userId = AuthUtil.currentUserId();
        User user = authService.getUserById(userId);
        return new UserProfileResponse(user);
    }

    @PutMapping("/me")
    public UserProfileResponse updateName(@RequestBody UpdateNameRequest req) {
        String userId = AuthUtil.currentUserId();
        User user = authService.updateName(userId, req.getName());
        return new UserProfileResponse(user);
    }

    @PutMapping("/me/password")
    public void changePassword(@RequestBody ChangePasswordRequest req) {
        String userId = AuthUtil.currentUserId();
        authService.changePassword(
                userId,
                req.getCurrentPassword(),
                req.getNewPassword(),
                req.getConfirmPassword()
        );
    }

    @Getter
    public static class UserProfileResponse {
        private final String id;
        private final String name;
        private final String email;
        private final String role;
        private final String userCode;

        public UserProfileResponse(User user) {
            this.id = user.getId();
            this.name = user.getName();
            this.email = user.getEmail();
            this.role = user.getRole() != null ? user.getRole().name() : null;
            this.userCode = user.getUserCode();
        }
    }

    @Getter
    @Setter
    public static class UpdateNameRequest {
        private String name;
    }

    @Getter
    @Setter
    public static class ChangePasswordRequest {
        private String currentPassword;
        private String newPassword;
        private String confirmPassword;
    }
}