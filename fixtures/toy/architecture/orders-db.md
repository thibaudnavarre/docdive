---
id: OrdersDB
parent: system
---
```mermaid
flowchart LR
  ConnectionPool --> Primary
```

```mermaid
flowchart LR
  ConnectionPool --> Replica
  classDef author fill:#ffe0b2,stroke:#e65100
  class Replica author
  style ConnectionPool fill:#c8e6c9
```
