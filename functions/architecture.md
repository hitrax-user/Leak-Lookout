# Архитектура Leak Lookout

## Диаграмма компонентов

```mermaid
graph TD
    subgraph "Firebase Cloud Functions"
        A[onGithubScanRequest] --> B[performScan]
        C[scheduledScan] --> D[createTasksForAllRepos]
        E[processScanTask] --> B
        
        B --> F[processRepository]
        F --> G[getRepositoryFiles]
        F --> H[processBatch]
        
        H --> I[processFile]
        I --> J[getFileContent]
        I --> K[processFileContent]
        
        K --> L[scanContentForLeaks]
        L --> M[findLeakCandidates]
        L --> N[isKnownFalsePositive]
        L --> O[isFalsePositiveLineContext]
        
        P[setupScanQueues] --> Q[createOrUpdateQueue]
    end
    
    subgraph "Cloud Tasks"
        R[scan-queue]
        S[file-processing-queue]
        T[leak-validation-queue]
        
        D --> R
        R --> E
    end
    
    subgraph "Firestore"
        U[(github_repos_to_scan)]
        V[(leaks)]
        
        A --> U
        L --> V
    end
    
    subgraph "External APIs"
        W[GitHub API]
        X[GitLab API]
        
        G --> W
        G --> X
        J --> W
        J --> X
    end
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style C fill:#f9f,stroke:#333,stroke-width:2px
    style E fill:#f9f,stroke:#333,stroke-width:2px
    style P fill:#f9f,stroke:#333,stroke-width:2px
    
    style R fill:#bbf,stroke:#333,stroke-width:2px
    style S fill:#bbf,stroke:#333,stroke-width:2px
    style T fill:#bbf,stroke:#333,stroke-width:2px
    
    style U fill:#bfb,stroke:#333,stroke-width:2px
    style V fill:#bfb,stroke:#333,stroke-width:2px
    
    style W fill:#fbb,stroke:#333,stroke-width:2px
    style X fill:#fbb,stroke:#333,stroke-width:2px
```

## Диаграмма последовательности

```mermaid
sequenceDiagram
    participant User
    participant Firestore
    participant CloudFunction
    participant CloudTasks
    participant GitHub
    participant GitLab
    
    User->>Firestore: Создает документ в github_repos_to_scan
    Firestore->>CloudFunction: Триггер onGithubScanRequest
    CloudFunction->>GitHub: Поиск репозитория
    GitHub-->>CloudFunction: Информация о репозитории
    CloudFunction->>GitHub: Получение файлов
    GitHub-->>CloudFunction: Список файлов
    
    loop Для каждого файла
        CloudFunction->>GitHub: Получение содержимого
        GitHub-->>CloudFunction: Содержимое файла
        CloudFunction->>CloudFunction: Сканирование на утечки
        CloudFunction->>Firestore: Сохранение обнаруженных утечек
    end
    
    CloudFunction->>Firestore: Обновление статуса сканирования
    
    Note over CloudFunction,CloudTasks: Запланированное сканирование
    
    CloudFunction->>Firestore: Получение всех репозиториев
    Firestore-->>CloudFunction: Список репозиториев
    
    loop Для каждого репозитория
        CloudFunction->>CloudTasks: Создание задачи сканирования
    end
    
    CloudTasks->>CloudFunction: Выполнение задачи processScanTask
    
    alt GitHub Repository
        CloudFunction->>GitHub: API запросы
    else GitLab Project
        CloudFunction->>GitLab: API запросы
    end
    
    CloudFunction->>Firestore: Сохранение результатов
```

## Диаграмма развертывания

```mermaid
graph TD
    subgraph "Google Cloud Platform"
        subgraph "Firebase"
            A[Cloud Functions]
            B[Firestore]
            C[Secret Manager]
        end
        
        subgraph "Cloud Tasks"
            D[Очереди задач]
        end
        
        subgraph "Cloud Scheduler"
            E[Запланированные задачи]
        end
    end
    
    subgraph "External Services"
        F[GitHub API]
        G[GitLab API]
    end
    
    E --> A
    A --> B
    A --> C
    A --> D
    D --> A
    A --> F
    A --> G
    
    style A fill:#f9f,stroke:#333,stroke-width:2px
    style B fill:#bbf,stroke:#333,stroke-width:2px
    style C fill:#bbf,stroke:#333,stroke-width:2px
    style D fill:#bfb,stroke:#333,stroke-width:2px
    style E fill:#bfb,stroke:#333,stroke-width:2px
    style F fill:#fbb,stroke:#333,stroke-width:2px
    style G fill:#fbb,stroke:#333,stroke-width:2px
