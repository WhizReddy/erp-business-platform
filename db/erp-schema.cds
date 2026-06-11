using { Currency, Country, custom.managed, sap.common.CodeList } from './common';

namespace sap.fe.cap.erp;

// ──────────────────────────────────────────────────────────────────────────────
// Master Data
// ──────────────────────────────────────────────────────────────────────────────

entity Department : CodeList {
  key code : String(4) enum {
    Engineering = 'ENGI';
    Sales       = 'SALE';
    Finance     = 'FINA';
    HR          = 'HURE';
    Operations  = 'OPER';
    IT          = 'ITSE';
  };
};

entity Employee : managed {
  key EmployeeUUID  : UUID;
  EmployeeID        : Integer default 0 @readonly;
  FirstName         : String(40) @mandatory;
  LastName          : String(40) @mandatory;
  Email             : String(256) @mandatory;
  PhoneNumber       : String(30);
  HireDate          : Date;
  JobTitle          : String(80);
  SalaryBand        : String(10);
  Department        : Association to Department;
  IsActive          : Boolean default true;
  to_Orders         : Association to many Order on to_Orders.to_Manager.EmployeeUUID = EmployeeUUID;
};

entity Client : managed {
  key ClientUUID    : UUID;
  ClientID          : Integer default 0 @readonly;
  CompanyName       : String(100) @mandatory;
  ContactPerson     : String(80);
  Email             : String(256) @mandatory;
  PhoneNumber       : String(30);
  Street            : String(60);
  PostalCode        : String(10);
  City              : String(40);
  CountryCode       : Country;
  VATNumber         : String(20);
  CreditLimit       : Decimal(16,3) default 50000;
  CurrencyCode      : Currency default 'EUR';
  IsActive          : Boolean default true;
  to_Orders         : Composition of many Order on to_Orders.to_Client.ClientUUID = ClientUUID;
};

entity Product : managed {
  key ProductUUID   : UUID;
  ProductID         : Integer default 0 @readonly;
  SKU               : String(20) @mandatory;
  Name              : String(100) @mandatory;
  Description       : String(1024);
  Category          : String(40);
  UnitPrice         : Decimal(16,3) @mandatory;
  CurrencyCode      : Currency default 'EUR';
  StockQuantity     : Integer default 0;
  MinStockLevel     : Integer default 10;
  IsActive          : Boolean default true;
};


// ──────────────────────────────────────────────────────────────────────────────
// Transactional Entities
// ──────────────────────────────────────────────────────────────────────────────

entity Order : managed {
  key OrderUUID     : UUID;
  OrderID           : Integer default 0 @readonly;
  OrderDate         : Date @mandatory;
  DeliveryDate      : Date;
  TotalAmount       : Decimal(16,3) default 0 @readonly;
  CurrencyCode      : Currency default 'EUR';
  Notes             : String(1024);
  OrderStatus       : Association to OrderStatus default 'DR' @readonly;
  to_Client         : Association to Client @mandatory;
  to_Manager        : Association to Employee;
  to_Items          : Composition of many OrderItem on to_Items.to_Order.OrderUUID = OrderUUID;
  to_Invoice        : Association to Invoice on to_Invoice.to_Order.OrderUUID = OrderUUID;
  to_Approval       : Association to Approval on to_Approval.to_Order.OrderUUID = OrderUUID;
};

entity OrderItem : managed {
  key ItemUUID      : UUID;
  ItemID            : Integer default 0 @readonly;
  Quantity          : Integer default 1 @mandatory;
  UnitPrice         : Decimal(16,3) @mandatory;
  Discount          : Decimal(5,2) default 0;
  LineTotal         : Decimal(16,3) @readonly;
  CurrencyCode      : Currency default 'EUR';
  Notes             : String(256);
  to_Order          : Association to Order;
  to_Product        : Association to Product @mandatory;
};

entity Invoice : managed {
  key InvoiceUUID   : UUID;
  InvoiceID         : Integer default 0 @readonly;
  IssueDate         : Date @mandatory;
  DueDate           : Date @mandatory;
  TotalAmount       : Decimal(16,3) @readonly;
  PaidAmount        : Decimal(16,3) default 0;
  CurrencyCode      : Currency default 'EUR';
  InvoiceStatus     : Association to InvoiceStatus default 'UNPA';
  to_Order          : Association to Order;
  to_Client         : Association to Client;
  Notes             : String(1024);
};

entity Approval : managed {
  key ApprovalUUID  : UUID;
  ApprovalID        : Integer default 0 @readonly;
  RequestDate       : Date @mandatory;
  DecisionDate      : Date;
  Comments          : String(1024);
  ApprovalStatus    : Association to ApprovalStatus default 'PEND';
  ApprovedBy        : String(256);
  to_Order          : Association to Order;
  to_Employee       : Association to Employee;
};


// ──────────────────────────────────────────────────────────────────────────────
// Code Lists
// ──────────────────────────────────────────────────────────────────────────────

type OrderStatusCode : String(4) enum {
  Draft     = 'DR';
  Submitted = 'SU';
  Approved  = 'AP';
  Rejected  = 'RE';
  Fulfilled = 'FU';
  Canceled  = 'CA';
};

entity OrderStatus : CodeList {
  key code : OrderStatusCode;
};

type InvoiceStatusCode : String(4) enum {
  Unpaid    = 'UNPA';
  PartPaid  = 'PART';
  Paid      = 'PAID';
  Overdue   = 'OVER';
  Canceled  = 'CANC';
};

entity InvoiceStatus : CodeList {
  key code : InvoiceStatusCode;
};

type ApprovalStatusCode : String(4) enum {
  Pending  = 'PEND';
  Approved = 'APPR';
  Rejected = 'REJC';
};

entity ApprovalStatus : CodeList {
  key code : ApprovalStatusCode;
};
