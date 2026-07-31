package com.batchpilot.service;

/** Thrown by {@link YarnRestClient} whenever the ResourceManager's REST API can't be reached
 * or returns something unusable - the signal for {@link YarnService} to fall back to the SSH
 * `yarn` CLI path instead. Never surfaced to callers of {@link YarnService} directly. */
class YarnRestUnavailableException extends RuntimeException {
    YarnRestUnavailableException(String message) {
        super(message);
    }

    YarnRestUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
