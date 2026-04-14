package com.paul.paul_backend.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.List;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {

        String authHeader = request.getHeader("Authorization");

        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);

            try {
                if (JwtUtil.isTokenValid(token)
                        && SecurityContextHolder.getContext().getAuthentication() == null) {

                    String userId = JwtUtil.extractUserId(token);
                    String role = JwtUtil.extractRole(token);

                    List<SimpleGrantedAuthority> authorities =
                            role != null
                                    ? List.of(new SimpleGrantedAuthority("ROLE_" + role))
                                    : Collections.emptyList();

                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(userId, null, authorities);

                    SecurityContextHolder.getContext().setAuthentication(authentication);

                    System.out.println("JWT authenticated userId = " + userId);
                    System.out.println("Authorization header = " + authHeader);
                    System.out.println("Extracted userId from token = " + userId);
                    System.out.println("Extracted role from token = " + role);
                }
            } catch (Exception e) {
                SecurityContextHolder.clearContext();
                System.out.println("JWT filter error: " + e.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }
}