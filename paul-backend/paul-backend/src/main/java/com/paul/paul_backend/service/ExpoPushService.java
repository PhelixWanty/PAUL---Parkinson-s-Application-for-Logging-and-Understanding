package com.paul.paul_backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.paul.paul_backend.model.PushToken;
import lombok.RequiredArgsConstructor;
import okhttp3.*;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ExpoPushService {

    private final OkHttpClient client = new OkHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public void sendPushToTokens(
            List<PushToken> tokens,
            String title,
            String body,
            Map<String, Object> data
    ) {
        if (tokens == null || tokens.isEmpty()) return;

        for (PushToken token : tokens) {
            if (token.getExpoPushToken() == null || token.getExpoPushToken().isBlank()) {
                continue;
            }

            try {
                Map<String, Object> payload = new HashMap<>();
                payload.put("to", token.getExpoPushToken());
                payload.put("title", title);
                payload.put("body", body);
                payload.put("sound", "default");
                payload.put("data", data);

                RequestBody requestBody = RequestBody.create(
                        objectMapper.writeValueAsString(payload),
                        MediaType.parse("application/json")
                );

                Request request = new Request.Builder()
                        .url("https://exp.host/--/api/v2/push/send")
                        .post(requestBody)
                        .addHeader("Accept", "application/json")
                        .addHeader("Accept-Encoding", "gzip, deflate")
                        .addHeader("Content-Type", "application/json")
                        .build();

                try (Response response = client.newCall(request).execute()) {
                    if (!response.isSuccessful()) {
                        System.out.println("Expo push failed for token " + token.getExpoPushToken()
                                + " status=" + response.code());
                    }
                }
            } catch (IOException e) {
                System.out.println("Expo push error: " + e.getMessage());
            }
        }
    }
}