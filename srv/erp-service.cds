using { sap.fe.cap.erp as erp } from '../db/erp-schema';

// ──────────────────────────────────────────────────────────────────────────────
// ERP Service — exposed at /erp
// ──────────────────────────────────────────────────────────────────────────────

service ERPService @(path:'/erp') {

  // ── Employees ──────────────────────────────────────────────────────────────
  @(restrict: [
    { grant: 'READ',  to: 'authenticated-user' },
    { grant: ['*'],   to: ['hr', 'admin'] }
  ])
  entity Employees as projection on erp.Employee;

  // ── Clients ────────────────────────────────────────────────────────────────
  @(restrict: [
    { grant: 'READ',  to: 'authenticated-user' },
    { grant: ['*'],   to: ['clerk', 'manager', 'admin'] }
  ])
  entity Clients as projection on erp.Client;

  // ── Products ───────────────────────────────────────────────────────────────
  @(restrict: [
    { grant: 'READ',  to: 'authenticated-user' },
    { grant: ['*'],   to: ['clerk', 'manager', 'admin'] }
  ])
  entity Products as projection on erp.Product;

  // ── Orders ─────────────────────────────────────────────────────────────────
  @(restrict: [
    { grant: 'READ',                              to: 'authenticated-user' },
    { grant: ['CREATE', 'UPDATE', 'DELETE'],       to: ['clerk', 'manager', 'admin'] },
    { grant: ['submitOrder', 'cancelOrder'],       to: ['clerk', 'manager', 'admin'] },
    { grant: ['approveOrder', 'rejectOrder', 'generateInvoice'], to: ['manager', 'admin'] }
  ])
  entity Orders as projection on erp.Order actions {
    action submitOrder()   returns Orders;
    action approveOrder(comments : String) returns Orders;
    action rejectOrder(comments  : String) returns Orders;
    action cancelOrder()   returns Orders;
    action generateInvoice(dueInDays : Integer) returns Invoices;
  };

  // ── Order Items ────────────────────────────────────────────────────────────
  @(restrict: [
    { grant: 'READ',  to: 'authenticated-user' },
    { grant: ['*'],   to: ['clerk', 'manager', 'admin'] }
  ])
  entity OrderItems as projection on erp.OrderItem;

  // ── Invoices ───────────────────────────────────────────────────────────────
  @(restrict: [
    { grant: 'READ',  to: 'authenticated-user' },
    { grant: ['*'],   to: ['manager', 'admin'] },
    { grant: ['recordPayment'], to: ['manager', 'admin'] }
  ])
  entity Invoices as projection on erp.Invoice actions {
    action recordPayment(amount : Decimal(16,3)) returns Invoices;
  };

  // ── Approvals ──────────────────────────────────────────────────────────────
  @(restrict: [
    { grant: 'READ',  to: 'authenticated-user' },
    { grant: ['*'],   to: ['manager', 'admin'] }
  ])
  entity Approvals as projection on erp.Approval;

  // ── Code Lists (auto-exposed, read-only) ───────────────────────────────────
  entity OrderStatuses   as projection on erp.OrderStatus;
  entity InvoiceStatuses as projection on erp.InvoiceStatus;
  entity ApprovalStatuses as projection on erp.ApprovalStatus;
  entity Departments     as projection on erp.Department;

}

// ──────────────────────────────────────────────────────────────────────────────
// ERP Analytics Service — exposed at /erp-analytics (read-only)
// ──────────────────────────────────────────────────────────────────────────────

service ERPAnalyticsService @(path:'/erp-analytics') {

  @readonly entity RevenueByMonth as select from erp.Invoice {
    key InvoiceUUID,
    IssueDate,
    TotalAmount,
    PaidAmount,
    CurrencyCode,
    to_Client.CompanyName as ClientName
  };

  @readonly entity OrdersByStatus as select from erp.Order {
    key OrderUUID,
    OrderID,
    OrderDate,
    TotalAmount,
    CurrencyCode,
    OrderStatus.code as StatusCode,
    to_Client.CompanyName as ClientName,
    to_Manager.FirstName  as ManagerFirstName,
    to_Manager.LastName   as ManagerLastName
  };

  @readonly entity TopClients as select from erp.Client {
    key ClientUUID,
    ClientID,
    CompanyName,
    City,
    CountryCode,
    CreditLimit,
    CurrencyCode
  };

}


