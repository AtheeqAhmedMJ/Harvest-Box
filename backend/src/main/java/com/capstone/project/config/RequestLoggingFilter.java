package com.capstone.project.config;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Logs every inbound request: method, URI, status, duration.
 * Sensitive paths (auth) log at DEBUG level only.
 */
@Component
@Order(1)
public class RequestLoggingFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);

    @Override
    public void doFilter(ServletRequest req, ServletResponse res, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest  httpReq = (HttpServletRequest)  req;
        HttpServletResponse httpRes = (HttpServletResponse) res;

        long   start  = System.currentTimeMillis();
        String method = httpReq.getMethod();
        String uri    = httpReq.getRequestURI();

        try {
            chain.doFilter(req, res);
        } finally {
            long   duration = System.currentTimeMillis() - start;
            int    status   = httpRes.getStatus();
            String msg      = "{} {} → {} ({}ms)";

            if (uri.startsWith("/api/v1/auth")) {
                log.debug(msg, method, uri, status, duration);
            } else if (status >= 500) {
                log.error(msg, method, uri, status, duration);
            } else if (status >= 400) {
                log.warn(msg, method, uri, status, duration);
            } else {
                log.info(msg, method, uri, status, duration);
            }
        }
    }
}
