import cds from '@sap/cds'

export class ERPService extends cds.ApplicationService { init() {

  const {
    Orders, OrderItems, Invoices, Approvals,
    Employees, Clients, Products
  } = this.entities

  // ────────────────────────────────────────────────────────────────────────────
  // Auto-increment IDs
  // ────────────────────────────────────────────────────────────────────────────

  this.before('CREATE', Employees, async (req: cds.Request) => {
    const { maxID } = await SELECT.one(`max(EmployeeID) as maxID`).from(Employees) as { maxID: number }
    req.data.EmployeeID = (maxID || 0) + 1
  })

  this.before('CREATE', Clients, async (req: cds.Request) => {
    const { maxID } = await SELECT.one(`max(ClientID) as maxID`).from(Clients) as { maxID: number }
    req.data.ClientID = (maxID || 0) + 1
  })

  this.before('CREATE', Products, async (req: cds.Request) => {
    const { maxID } = await SELECT.one(`max(ProductID) as maxID`).from(Products) as { maxID: number }
    req.data.ProductID = (maxID || 0) + 1
  })

  this.before('CREATE', Orders, async (req: cds.Request) => {
    const { maxID } = await SELECT.one(`max(OrderID) as maxID`).from(Orders) as { maxID: number }
    req.data.OrderID = (maxID || 0) + 1
    if (!req.data.OrderDate) req.data.OrderDate = new Date().toISOString().split('T')[0]
  })

  this.before('CREATE', OrderItems, async (req: cds.Request) => {
    const { maxID } = await SELECT.one(`max(ItemID) as maxID`).from(OrderItems) as { maxID: number }
    req.data.ItemID = (maxID || 0) + 1
  })

  this.before('CREATE', Invoices, async (req: cds.Request) => {
    const { maxID } = await SELECT.one(`max(InvoiceID) as maxID`).from(Invoices) as { maxID: number }
    req.data.InvoiceID = (maxID || 0) + 1
  })

  this.before('CREATE', Approvals, async (req: cds.Request) => {
    const { maxID } = await SELECT.one(`max(ApprovalID) as maxID`).from(Approvals) as { maxID: number }
    req.data.ApprovalID = (maxID || 0) + 1
  })


  // ────────────────────────────────────────────────────────────────────────────
  // OrderItem: compute LineTotal on CREATE / UPDATE
  // ────────────────────────────────────────────────────────────────────────────

  async function computeLineTotal(req: cds.Request) {
    let { Quantity, UnitPrice, Discount } = req.data
    
    // For PATCH updates, fetch existing values if not provided
    if (req.event === 'UPDATE' && (Quantity == null || UnitPrice == null || Discount == null)) {
      const ItemUUID = req.data.ItemUUID
      if (ItemUUID) {
        const existing = await SELECT.one(OrderItems).where({ ItemUUID }).columns('Quantity', 'UnitPrice', 'Discount')
        if (existing) {
          Quantity = Quantity ?? existing.Quantity
          UnitPrice = UnitPrice ?? existing.UnitPrice
          Discount = Discount ?? existing.Discount
        }
      }
    }

    if (Quantity != null && UnitPrice != null) {
      const discount = Discount ?? 0
      req.data.LineTotal = parseFloat(
        (Quantity * UnitPrice * (1 - discount / 100)).toFixed(3)
      )
    }
  }

  this.before('CREATE', OrderItems, computeLineTotal)
  this.before('UPDATE', OrderItems, computeLineTotal)


  // ────────────────────────────────────────────────────────────────────────────
  // Order: recalculate TotalAmount whenever items change
  // ────────────────────────────────────────────────────────────────────────────

  async function recalcOrderTotal(orderUUID: string) {
    const result = await SELECT.one(
      `coalesce(sum(LineTotal), 0) as total`
    ).from(OrderItems).where({ to_Order_OrderUUID: orderUUID }) as { total: number }

    await UPDATE(Orders, { OrderUUID: orderUUID })
      .set({ TotalAmount: result.total })
  }

  this.after(['CREATE', 'UPDATE', 'DELETE'], OrderItems, async (item: any, req: cds.Request) => {
    let orderUUID = item?.to_Order_OrderUUID
    // On PATCH, the returned item might only contain the updated fields.
    if (!orderUUID && req.data?.ItemUUID) {
      const existing = await SELECT.one(OrderItems).where({ ItemUUID: req.data.ItemUUID }).columns('to_Order_OrderUUID')
      orderUUID = existing?.to_Order_OrderUUID
    }
    if (!orderUUID && req.params && req.params[0]) {
      const existing = await SELECT.one(OrderItems).where(req.params[0]).columns('to_Order_OrderUUID')
      orderUUID = existing?.to_Order_OrderUUID
    }
    if (orderUUID) {
      await recalcOrderTotal(orderUUID)
    }
  })


  // ────────────────────────────────────────────────────────────────────────────
  // Validations
  // ────────────────────────────────────────────────────────────────────────────

  this.before(['CREATE', 'UPDATE'], Orders, async (req: cds.Request) => {
    const { OrderDate, DeliveryDate } = req.data
    if (OrderDate && DeliveryDate && DeliveryDate < OrderDate) {
      req.error(400, `Delivery Date must be on or after Order Date.`, 'in/DeliveryDate')
    }
  })

  this.before(['CREATE', 'UPDATE'], OrderItems, async (req: cds.Request) => {
    const { UnitPrice, Quantity, Discount } = req.data
    if (UnitPrice != null && UnitPrice <= 0)
      req.error(400, `Unit Price must be greater than 0.`, 'in/UnitPrice')
    if (Quantity != null && Quantity <= 0)
      req.error(400, `Quantity must be greater than 0.`, 'in/Quantity')
    if (Discount != null && (Discount < 0 || Discount > 100))
      req.error(400, `Discount must be between 0 and 100.`, 'in/Discount')
  })

  this.before(['CREATE', 'UPDATE'], Products, async (req: cds.Request) => {
    const { UnitPrice } = req.data
    if (UnitPrice != null && UnitPrice <= 0)
      req.error(400, `Unit Price must be greater than 0.`, 'in/UnitPrice')
  })


  // ────────────────────────────────────────────────────────────────────────────
  // Guard: Orders in terminal states cannot be modified
  // ────────────────────────────────────────────────────────────────────────────

  this.before(['UPDATE', 'DELETE'], Orders, async (req: cds.Request) => {
    const order = await SELECT.one(Orders).where(req.params[0]).columns('OrderStatus_code')
    if (!order) return
    const locked = ['AP', 'FU', 'CA']
    if (locked.includes(order.OrderStatus_code)) {
      req.error(423, `Order is in status "${order.OrderStatus_code}" and cannot be modified.`)
    }
  })


  // ────────────────────────────────────────────────────────────────────────────
  // Actions
  // ────────────────────────────────────────────────────────────────────────────

  const { submitOrder, approveOrder, rejectOrder, cancelOrder, generateInvoice } = this.entities.Orders.actions as any
  const { recordPayment } = this.entities.Invoices.actions as any

  // Submit: DR → SU
  this.on(submitOrder, async (req: cds.Request) => {
    const order = await SELECT.one(Orders).where(req.params[0])
    if (!order) return req.reject(404, `Order not found.`)
    if (order.OrderStatus_code !== 'DR')
      return req.reject(400, `Only Draft orders can be submitted. Current status: ${order.OrderStatus_code}`)
    await UPDATE(Orders).where(req.params[0]).set({ OrderStatus_code: 'SU' })

    // Create a pending approval record
    const { maxID } = await SELECT.one(`max(ApprovalID) as maxID`).from(Approvals) as { maxID: number }
    await INSERT.into(Approvals).entries({
      ApprovalUUID:         cds.utils.uuid(),
      ApprovalID:           (maxID || 0) + 1,
      RequestDate:          new Date().toISOString().split('T')[0],
      ApprovalStatus_code:  'PEND',
      to_Order_OrderUUID:   order.OrderUUID,
      to_Employee_EmployeeUUID: null
    })
    return SELECT.one(Orders).where(req.params[0])
  })

  // Approve: SU → AP
  this.on(approveOrder, async (req: cds.Request) => {
    const order = await SELECT.one(Orders).where(req.params[0])
    if (!order) return req.reject(404, `Order not found.`)
    if (order.OrderStatus_code !== 'SU')
      return req.reject(400, `Only Submitted orders can be approved. Current status: ${order.OrderStatus_code}`)

    await UPDATE(Orders).where(req.params[0]).set({ OrderStatus_code: 'AP' })
    await UPDATE(Approvals).where({ to_Order_OrderUUID: order.OrderUUID }).set({
      ApprovalStatus_code: 'APPR',
      DecisionDate:        new Date().toISOString().split('T')[0],
      ApprovedBy:          req.user.id,
      Comments:            req.data.comments || ''
    })
    return SELECT.one(Orders).where(req.params[0])
  })

  // Reject: SU → RE
  this.on(rejectOrder, async (req: cds.Request) => {
    const order = await SELECT.one(Orders).where(req.params[0])
    if (!order) return req.reject(404, `Order not found.`)
    if (order.OrderStatus_code !== 'SU')
      return req.reject(400, `Only Submitted orders can be rejected. Current status: ${order.OrderStatus_code}`)

    await UPDATE(Orders).where(req.params[0]).set({ OrderStatus_code: 'RE' })
    await UPDATE(Approvals).where({ to_Order_OrderUUID: order.OrderUUID }).set({
      ApprovalStatus_code: 'REJC',
      DecisionDate:        new Date().toISOString().split('T')[0],
      ApprovedBy:          req.user.id,
      Comments:            req.data.comments || ''
    })
    return SELECT.one(Orders).where(req.params[0])
  })

  // Cancel: DR/SU → CA
  this.on(cancelOrder, async (req: cds.Request) => {
    const order = await SELECT.one(Orders).where(req.params[0])
    if (!order) return req.reject(404, `Order not found.`)
    if (!['DR', 'SU'].includes(order.OrderStatus_code))
      return req.reject(400, `Only Draft or Submitted orders can be canceled.`)
    await UPDATE(Orders).where(req.params[0]).set({ OrderStatus_code: 'CA' })
    return SELECT.one(Orders).where(req.params[0])
  })

  // Generate Invoice from Approved order
  this.on(generateInvoice, async (req: cds.Request) => {
    const order = await SELECT.one(Orders).where(req.params[0])
    if (!order) return req.reject(404, `Order not found.`)
    if (order.OrderStatus_code !== 'AP')
      return req.reject(400, `Invoices can only be generated for Approved orders.`)

    const existing = await SELECT.one(Invoices).where({ to_Order_OrderUUID: order.OrderUUID })
    if (existing) return req.reject(409, `An invoice already exists for this order.`)

    const dueInDays = req.data.dueInDays ?? 30
    const issueDate = new Date()
    const dueDate   = new Date(issueDate.getTime() + dueInDays * 86400000)

    const { maxID } = await SELECT.one(`max(InvoiceID) as maxID`).from(Invoices) as { maxID: number }
    await INSERT.into(Invoices).entries({
      InvoiceUUID:             cds.utils.uuid(),
      InvoiceID:               (maxID || 0) + 1,
      IssueDate:               issueDate.toISOString().split('T')[0],
      DueDate:                 dueDate.toISOString().split('T')[0],
      TotalAmount:             order.TotalAmount,
      PaidAmount:              0,
      CurrencyCode:            order.CurrencyCode,
      InvoiceStatus_code:      'UNPA',
      to_Order_OrderUUID:      order.OrderUUID,
      to_Client_ClientUUID:    order.to_Client_ClientUUID
    })

    // Mark order as fulfilled
    await UPDATE(Orders).where(req.params[0]).set({ OrderStatus_code: 'FU' })
    return SELECT.one(Invoices).where({ to_Order_OrderUUID: order.OrderUUID })
  })

  // Record Payment on Invoice
  this.on(recordPayment, async (req: cds.Request) => {
    const invoice = await SELECT.one(Invoices).where(req.params[0])
    if (!invoice) return req.reject(404, `Invoice not found.`)
    if (['PAID', 'CANC'].includes(invoice.InvoiceStatus_code))
      return req.reject(400, `Invoice is already ${invoice.InvoiceStatus_code}.`)

    const newPaid = parseFloat(((invoice.PaidAmount || 0) + req.data.amount).toFixed(3))
    const remaining = invoice.TotalAmount - newPaid
    let status: string

    if (remaining <= 0) {
      status = 'PAID'
    } else if (newPaid > 0) {
      status = 'PART'
    } else {
      status = invoice.InvoiceStatus_code
    }

    // Check if overdue
    const today = new Date().toISOString().split('T')[0]
    if (status !== 'PAID' && invoice.DueDate < today) status = 'OVER'

    await UPDATE(Invoices).where(req.params[0]).set({
      PaidAmount:          newPaid,
      InvoiceStatus_code:  status
    })
    return SELECT.one(Invoices).where(req.params[0])
  })

  return super.init()
}}
