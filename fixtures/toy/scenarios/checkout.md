---
id: checkout-happy-path
kind: scenario
---
```mermaid
sequenceDiagram
  API->>OrderService: POST /orders
  OrderService->>PaymentGateway: charge()
  PaymentGateway-->>OrderService: ok
  OrderService->>PaymentGateway: capture()
  PaymentGateway-->>OrderService: ok
  OrderService->>OrdersDB: INSERT
```
