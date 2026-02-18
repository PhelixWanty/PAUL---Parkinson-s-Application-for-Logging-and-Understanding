package com.paul.paul_backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.Date;

public class JwtUtil {

    // MUST be at least 32 characters for HS256
    private static final String SECRET = "PAUL_SUPER_SECRET_KEY_32CHARS_MINIMUM!!";

    private static final long EXP_MS = 86400000; // 24 hours

    private static Key getSigningKey() {
        return Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
    }

    public static String generateToken(String email, String role) {
        return Jwts.builder()
                .setSubject(email)
                .claim("role", role)
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + EXP_MS))
                .signWith(getSigningKey())
                .compact();
    }

    public static Claims parseClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(getSigningKey())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    public static boolean isTokenValid(String token) {
        try {
            Claims c = parseClaims(token);
            return c.getExpiration().after(new Date());
        } catch (Exception e) {
            return false;
        }
    }

    public static String extractEmail(String token) {
        return parseClaims(token).getSubject();
    }

    public static String extractRole(String token) {
        Object role = parseClaims(token).get("role");
        return role == null ? null : role.toString();
    }
}
