package ro.greenstruct.agro.config;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableScheduling
public class AppConfig {

    /** Runs dossier pipelines and agent calls; virtual threads keep blocking Bedrock calls cheap. */
    @Bean(destroyMethod = "shutdown")
    public ExecutorService pipelineExecutor() {
        return Executors.newVirtualThreadPerTaskExecutor();
    }

    @Bean
    public WebMvcConfigurer corsConfigurer(GreenStructProperties properties) {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins(properties.cors().allowedOrigins().toArray(String[]::new))
                        .allowedMethods("GET", "POST", "OPTIONS");
            }
        };
    }
}
