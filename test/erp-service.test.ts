/**
 * ERP Service — Jest Test Suite
 *
 * Tests cover:
 *  - CRUD operations on Clients, Products, Orders, OrderItems
 *  - Business logic: LineTotal computation, TotalAmount recalculation
 *  - Action workflows: submitOrder → approveOrder / rejectOrder → generateInvoice
 *  - Action: recordPayment on invoices
 *  - Validation: negative price, bad date range, wrong status transitions
 *  - RBAC: clerk cannot approve; manager can approve; anonymous gets 401
 */

import cds from '@sap/cds'

// ── Setup ─────────────────────────────────────────────────────────────────────
const { GET, POST, PUT, PATCH, DELETE, axios, expect } = cds.test(__dirname + '/..')

// Helper: POST an action bound to an entity
const action = (path: string, body = {}) => POST(path, body)

// ── Auth helpers ──────────────────────────────────────────────────────────────
const asClerk   = { username: 'alice', password: 'alice' }  // role: clerk
const asManager = { username: 'bob',   password: 'bob'   }  // role: manager
const asAdmin   = { username: 'admin', password: 'admin' }  // role: admin

axios.defaults.auth = asAdmin  // default: admin has full access

// ── Shared state across tests ─────────────────────────────────────────────────
let clientUUID: string
let productUUID: string
let orderUUID: string
let itemUUID: string
let invoiceRef: string

// ─────────────────────────────────────────────────────────────────────────────
describe('ERP — CRUD: Clients', () => {

  it('GET /erp/Clients — reads seed data', async () => {
    const { status, data } = await GET('/erp/Clients')
    expect(status).to.equal(200)
    expect(data.value).to.be.an('array').with.lengthOf.above(0)
    clientUUID = data.value[0].ClientUUID
  })

  it('GET /erp/Clients — contains TechNova from seed', async () => {
    const { data } = await GET('/erp/Clients?$filter=contains(CompanyName,\'TechNova\')')
    expect(data.value).to.containSubset([{ CompanyName: 'TechNova Solutions' }])
  })

  it('POST /erp/Clients — creates a new client', async () => {
    const { status, data } = await POST('/erp/Clients', {
      CompanyName: 'Test Corp GmbH',
      Email:       'test@testcorp.de',
      CreditLimit: 10000,
      CurrencyCode_code: 'EUR',
    })
    expect(status).to.equal(201)
    expect(data.CompanyName).to.equal('Test Corp GmbH')
    expect(data.ClientID).to.be.above(0)
    clientUUID = data.ClientUUID
  })

  it('PATCH /erp/Clients — updates a client', async () => {
    const { status, data } = await PATCH(`/erp/Clients(${clientUUID})`, {
      ContactPerson: 'Hans Müller',
    })
    expect(status).to.equal(200)
    expect(data.ContactPerson).to.equal('Hans Müller')
  })

})


// ─────────────────────────────────────────────────────────────────────────────
describe('ERP — CRUD: Products', () => {

  it('GET /erp/Products — reads seed data', async () => {
    const { status, data } = await GET('/erp/Products')
    expect(status).to.equal(200)
    expect(data.value.length).to.be.above(0)
    productUUID = data.value[0].ProductUUID
  })

  it('POST /erp/Products — creates a new product', async () => {
    const { status, data } = await POST('/erp/Products', {
      SKU:          'TEST-001',
      Name:         'Test Widget',
      UnitPrice:    99.99,
      CurrencyCode_code: 'EUR',
      StockQuantity: 100,
    })
    expect(status).to.equal(201)
    expect(data.ProductID).to.be.above(0)
    productUUID = data.ProductUUID
  })

  it('rejects negative unit price', async () => {
    const { status } = await POST('/erp/Products', {
      SKU:       'BAD-001',
      Name:      'Invalid',
      UnitPrice: -10,
    }).catch(e => e.response)
    // CAP returns 400 for constraint violation or assertion failure
    expect([400, 500]).to.include(status)
  })

})


// ─────────────────────────────────────────────────────────────────────────────
describe('ERP — Orders: Creation & Validation', () => {

  it('POST /erp/Orders — creates a draft order', async () => {
    const { status, data } = await POST('/erp/Orders', {
      OrderDate:    '2026-06-01',
      DeliveryDate: '2026-06-30',
      CurrencyCode_code: 'EUR',
      to_Client_ClientUUID: clientUUID,
    })
    expect(status).to.equal(201)
    expect(data.OrderID).to.be.above(0)
    expect(data.OrderStatus_code).to.equal('DR')
    orderUUID = data.OrderUUID
  })

  it('rejects DeliveryDate before OrderDate', async () => {
    const { status } = await POST('/erp/Orders', {
      OrderDate:    '2026-06-30',
      DeliveryDate: '2026-06-01',
      to_Client_ClientUUID: clientUUID,
    }).catch(e => e.response)
    expect(status).to.equal(400)
  })

  it('reads the created order', async () => {
    const { status, data } = await GET(`/erp/Orders(${orderUUID})`)
    expect(status).to.equal(200)
    expect(data.TotalAmount).to.equal(0)
  })

})


// ─────────────────────────────────────────────────────────────────────────────
describe('ERP — OrderItems: LineTotal & Order Totals', () => {

  it('POST /erp/OrderItems — adds an item and computes LineTotal', async () => {
    const { status, data } = await POST('/erp/OrderItems', {
      Quantity:         3,
      UnitPrice:        100.00,
      Discount:         10,
      CurrencyCode_code: 'EUR',
      to_Order_OrderUUID: orderUUID,
      to_Product_ProductUUID: productUUID,
    })
    expect(status).to.equal(201)
    // LineTotal = 3 * 100 * (1 - 10/100) = 270
    expect(data.LineTotal).to.equal(270)
    itemUUID = data.ItemUUID
  })

  it('OrderItem total recalculates parent Order.TotalAmount', async () => {
    const { data } = await GET(`/erp/Orders(${orderUUID})?$select=TotalAmount`)
    expect(data.TotalAmount).to.equal(270)
  })

  it('PATCH /erp/OrderItems — updating quantity recalculates LineTotal', async () => {
    const { data } = await PATCH(`/erp/OrderItems(${itemUUID})`, { Quantity: 5 })
    // LineTotal = 5 * 100 * 0.9 = 450
    expect(data.LineTotal).to.equal(450)
  })

  it('Order TotalAmount updated after patch', async () => {
    const { data } = await GET(`/erp/Orders(${orderUUID})?$select=TotalAmount`)
    expect(data.TotalAmount).to.equal(450)
  })

  it('rejects Quantity <= 0', async () => {
    const { status } = await PATCH(`/erp/OrderItems(${itemUUID})`, { Quantity: -1 })
      .catch(e => e.response)
    expect(status).to.equal(400)
  })

  it('rejects Discount > 100', async () => {
    const { status } = await PATCH(`/erp/OrderItems(${itemUUID})`, { Discount: 150 })
      .catch(e => e.response)
    expect(status).to.equal(400)
  })

})


// ─────────────────────────────────────────────────────────────────────────────
describe('ERP — Workflow: submitOrder → approveOrder → generateInvoice', () => {

  it('submitOrder — transitions order DR → SU and creates a pending Approval', async () => {
    const { status, data } = await action(
      `/erp/Orders(${orderUUID})/ERPService.submitOrder`
    )
    expect(status).to.equal(200)
    expect(data.OrderStatus_code).to.equal('SU')

    const { data: approvals } = await GET(
      `/erp/Approvals?$filter=to_Order_OrderUUID eq ${orderUUID}`
    )
    expect(approvals.value).to.have.lengthOf(1)
    expect(approvals.value[0].ApprovalStatus_code).to.equal('PEND')
  })

  it('submitOrder again fails — order already Submitted', async () => {
    const { status } = await action(
      `/erp/Orders(${orderUUID})/ERPService.submitOrder`
    ).catch(e => e.response)
    expect(status).to.equal(400)
  })

  it('clerk cannot approveOrder — only manager/admin can', async () => {
    axios.defaults.auth = asClerk
    const { status } = await action(
      `/erp/Orders(${orderUUID})/ERPService.approveOrder`,
      { comments: 'looks good' }
    ).catch(e => e.response)
    expect(status).to.equal(403)
    axios.defaults.auth = asAdmin
  })

  it('manager approveOrder — transitions SU → AP', async () => {
    axios.defaults.auth = asManager
    const { status, data } = await action(
      `/erp/Orders(${orderUUID})/ERPService.approveOrder`,
      { comments: 'Approved for testing' }
    )
    expect(status).to.equal(200)
    expect(data.OrderStatus_code).to.equal('AP')
    axios.defaults.auth = asAdmin
  })

  it('Approval record updated to APPR', async () => {
    const { data } = await GET(
      `/erp/Approvals?$filter=to_Order_OrderUUID eq ${orderUUID}`
    )
    expect(data.value[0].ApprovalStatus_code).to.equal('APPR')
    expect(data.value[0].ApprovedBy).to.equal('bob')
  })

  it('generateInvoice — creates invoice and marks order FU', async () => {
    const { status, data } = await action(
      `/erp/Orders(${orderUUID})/ERPService.generateInvoice`,
      { dueInDays: 30 }
    )
    expect(status).to.equal(200)
    expect(data.TotalAmount).to.equal(450)
    expect(data.InvoiceStatus_code).to.equal('UNPA')
    invoiceRef = data.InvoiceUUID

    const { data: order } = await GET(`/erp/Orders(${orderUUID})?$select=OrderStatus_code`)
    expect(order.OrderStatus_code).to.equal('FU')
  })

  it('generateInvoice again fails — invoice already exists or order not approved', async () => {
    const { status } = await action(
      `/erp/Orders(${orderUUID})/ERPService.generateInvoice`,
      { dueInDays: 30 }
    ).catch(e => e.response)
    expect(status).to.equal(400)
  })

})


// ─────────────────────────────────────────────────────────────────────────────
describe('ERP — Workflow: rejectOrder path', () => {

  let rejOrderUUID: string

  it('creates and submits another order', async () => {
    const { data: ord } = await POST('/erp/Orders', {
      OrderDate:    '2026-06-10',
      DeliveryDate: '2026-07-10',
      CurrencyCode_code: 'EUR',
      to_Client_ClientUUID: clientUUID,
    })
    rejOrderUUID = ord.OrderUUID
    await action(`/erp/Orders(${rejOrderUUID})/ERPService.submitOrder`)
  })

  it('rejectOrder — transitions SU → RE', async () => {
    axios.defaults.auth = asManager
    const { status, data } = await action(
      `/erp/Orders(${rejOrderUUID})/ERPService.rejectOrder`,
      { comments: 'Budget exceeded' }
    )
    expect(status).to.equal(200)
    expect(data.OrderStatus_code).to.equal('RE')
    axios.defaults.auth = asAdmin
  })

  it('cannot generate invoice for a rejected order', async () => {
    const { status } = await action(
      `/erp/Orders(${rejOrderUUID})/ERPService.generateInvoice`,
      { dueInDays: 30 }
    ).catch(e => e.response)
    expect(status).to.equal(400)
  })

})


// ─────────────────────────────────────────────────────────────────────────────
describe('ERP — Invoices: recordPayment', () => {

  it('partial payment changes status to PART', async () => {
    const { status, data } = await action(
      `/erp/Invoices(${invoiceRef})/ERPService.recordPayment`,
      { amount: 200 }
    )
    expect(status).to.equal(200)
    expect(data.PaidAmount).to.equal(200)
    expect(data.InvoiceStatus_code).to.equal('PART')
  })

  it('full payment changes status to PAID', async () => {
    const { data } = await action(
      `/erp/Invoices(${invoiceRef})/ERPService.recordPayment`,
      { amount: 250 }   // 200 + 250 = 450 = TotalAmount
    )
    expect(data.InvoiceStatus_code).to.equal('PAID')
  })

  it('cannot record payment on a PAID invoice', async () => {
    const { status } = await action(
      `/erp/Invoices(${invoiceRef})/ERPService.recordPayment`,
      { amount: 10 }
    ).catch(e => e.response)
    expect(status).to.equal(400)
  })

})


// ─────────────────────────────────────────────────────────────────────────────
describe('ERP — Analytics Service', () => {

  it('GET /erp-analytics/OrdersByStatus — returns order projections', async () => {
    const { status, data } = await GET('/erp-analytics/OrdersByStatus')
    expect(status).to.equal(200)
    expect(data.value.length).to.be.above(0)
    const first = data.value[0]
    expect(first).to.have.property('OrderUUID')
    expect(first).to.have.property('StatusCode')
    expect(first).to.have.property('TotalAmount')
  })

  it('GET /erp-analytics/TopClients — returns client list', async () => {
    const { status, data } = await GET('/erp-analytics/TopClients')
    expect(status).to.equal(200)
    expect(data.value.length).to.be.above(0)
  })

  it('GET /erp-analytics/RevenueByMonth — returns invoice projections', async () => {
    const { status, data } = await GET('/erp-analytics/RevenueByMonth')
    expect(status).to.equal(200)
    expect(data.value.length).to.be.above(0)
  })

})


// ─────────────────────────────────────────────────────────────────────────────
describe('ERP — RBAC enforcement', () => {

  it('anonymous user gets 401 on Orders', async () => {
    delete axios.defaults.auth
    const { status } = await GET('/erp/Orders').catch(e => e.response)
    expect(status).to.equal(401)
    axios.defaults.auth = asAdmin
  })

  it('clerk can READ Orders', async () => {
    axios.defaults.auth = asClerk
    const { status } = await GET('/erp/Orders')
    expect(status).to.equal(200)
    axios.defaults.auth = asAdmin
  })

  it('clerk CANNOT manage Employees', async () => {
    axios.defaults.auth = asClerk
    const { status } = await POST('/erp/Employees', {
      FirstName: 'Hacker', LastName: 'McHack', Email: 'h@h.com'
    }).catch(e => e.response)
    expect(status).to.equal(403)
    axios.defaults.auth = asAdmin
  })

  it('manager can READ Employees', async () => {
    axios.defaults.auth = asManager
    const { status } = await GET('/erp/Employees')
    expect(status).to.equal(200)
    axios.defaults.auth = asAdmin
  })

})
