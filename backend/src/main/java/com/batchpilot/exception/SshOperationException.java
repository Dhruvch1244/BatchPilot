package com.batchpilot.exception;

public class SshOperationException extends RuntimeException {
    public SshOperationException(String message) {
        super(message);
    }

    public SshOperationException(String message, Throwable cause) {
        super(message, cause);
    }
}
