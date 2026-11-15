---
id: system
---
```mermaid
flowchart LR
  API --> OrderService --> PaymentGateway
  OrderService -->|capture| PaymentGateway
  OrderService --> OrdersDB[(orders)]
```
