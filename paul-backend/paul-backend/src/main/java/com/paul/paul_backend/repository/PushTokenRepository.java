package com.paul.paul_backend.repository;

import com.paul.paul_backend.model.PushToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface PushTokenRepository extends MongoRepository<PushToken, String> {

    Optional<PushToken> findByUserIdAndExpoPushToken(String userId, String expoPushToken);

    List<PushToken> findByUserIdAndActiveTrue(String userId);
}