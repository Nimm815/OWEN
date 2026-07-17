USE websitebanhang;

-- Sample brands
INSERT INTO Brands (Name) VALUES
  ('OWEN Classic'),
  ('OWEN Urban'),
  ('OWEN Essentials')
ON DUPLICATE KEY UPDATE Name = VALUES(Name);

-- Sample categories
INSERT INTO Categories (Name) VALUES
  ('Outerwear'),
  ('Knitwear'),
  ('Footwear')
ON DUPLICATE KEY UPDATE Name = VALUES(Name);

-- Sample colors
INSERT INTO Colors (Code, Name) VALUES
  ('BLACK', 'Đen'),
  ('WHITE', 'Trắng'),
  ('BEIGE', 'Beige'),
  ('NAVY', 'Xanh Navy')
ON DUPLICATE KEY UPDATE Code = VALUES(Code), Name = VALUES(Name);

-- Sample sizes
INSERT INTO Sizes (Value) VALUES
  ('S'),
  ('M'),
  ('L'),
  ('XL')
ON DUPLICATE KEY UPDATE Value = VALUES(Value);

-- Sample products
INSERT INTO Products (SKU, Title, Description, Price, BrandId, CategoryId, IsActive) VALUES
  ('OWEN-001', 'Áo Khoác Nam OWEN Classic', 'Áo khoác nhẹ dành cho mùa thu, đường may tinh tế, phối layer dễ dàng.', 1290000.00, 1, 1, 1),
  ('OWEN-002', 'Áo Len Crewneck OWEN Urban', 'Áo len cổ tròn mềm mại, giữ ấm tốt, thích hợp mặc hàng ngày.', 850000.00, 2, 2, 1),
  ('OWEN-003', 'Giày Sneaker OWEN Essentials', 'Giày sneaker tối giản, form chuẩn, dễ kết hợp với mọi trang phục.', 1490000.00, 3, 3, 1)
ON DUPLICATE KEY UPDATE Title = VALUES(Title), Description = VALUES(Description), Price = VALUES(Price), BrandId = VALUES(BrandId), CategoryId = VALUES(CategoryId), IsActive = VALUES(IsActive);

-- Product images
INSERT INTO ProductImages (ProductId, ImageUrl, Position) VALUES
  (1, 'Images/card_reveal1.jpg', 1),
  (1, 'Images/card_reveal2.jpg', 2),
  (2, 'Images/card_reveal3.jpg', 1),
  (3, 'Images/card_reveal1.jpg', 1)
ON DUPLICATE KEY UPDATE ImageUrl = VALUES(ImageUrl), Position = VALUES(Position);

-- Product variants
INSERT INTO ProductVariants (ProductId, ColorId, SizeId, StockQty, Price) VALUES
  (1, 1, 1, 12, 1290000.00),
  (1, 1, 2, 8, 1290000.00),
  (1, 2, 2, 5, 1290000.00),
  (2, 2, 1, 15, 850000.00),
  (2, 3, 2, 10, 850000.00),
  (2, 4, 3, 7, 850000.00),
  (3, 1, 2, 20, 1490000.00),
  (3, 2, 3, 10, 1490000.00)
ON DUPLICATE KEY UPDATE StockQty = VALUES(StockQty), Price = VALUES(Price);

-- Comments / reviews
INSERT INTO Comments (UserId, ProductId, Rating, Content, Status) VALUES
  (2, 1, 5, 'Áo khoác rất đẹp, chất liệu tốt và ấm.', 'VISIBLE'),
  (2, 2, 4, 'Áo len rất mềm, mặc thoải mái nhưng giá hơi cao.', 'VISIBLE'),
  (2, 3, 5, 'Giày đi êm, kiểu dáng hiện đại.', 'VISIBLE');

-- Active cart for demo user
INSERT INTO Carts (UserId, Status) VALUES
  (2, 'ACTIVE')
ON DUPLICATE KEY UPDATE Status = VALUES(Status);

-- Add sample cart items
INSERT INTO CartProducts (CartId, ProductVariantId, Quantity, UnitPrice)
SELECT c.Id, v.Id, 2, v.Price
FROM Carts c
JOIN ProductVariants v ON v.ProductId = 1 AND v.SizeId = 2
WHERE c.UserId = 2 AND c.Status = 'ACTIVE'
ON DUPLICATE KEY UPDATE Quantity = VALUES(Quantity), UnitPrice = VALUES(UnitPrice);

-- Sample order
INSERT INTO Orders (OrderCode, UserId, RecipientName, RecipientPhone, RecipientAddress, PaymentMethod, Status, TotalAmount, Note) VALUES
  ('ORDER-20260717-001', 2, 'Nguyễn Văn A', '0912345678', '123 Nguyễn Trãi, Hà Nội', 'COD', 'PENDING', 2580000.00, 'Giao trong giờ hành chính')
ON DUPLICATE KEY UPDATE Status = VALUES(Status), TotalAmount = VALUES(TotalAmount), RecipientName = VALUES(RecipientName), RecipientPhone = VALUES(RecipientPhone), RecipientAddress = VALUES(RecipientAddress), Note = VALUES(Note);

INSERT INTO OrderItems (OrderId, ProductVariantId, Quantity, UnitPrice, TotalPrice)
SELECT o.Id, v.Id, 2, v.Price, v.Price * 2
FROM Orders o
JOIN ProductVariants v ON v.ProductId = 1 AND v.SizeId = 2
WHERE o.OrderCode = 'ORDER-20260717-001';

-- Sample VnPay transaction record for order
INSERT INTO VnPayTransactions (OrderId, TransactionId, Amount, Status)
SELECT o.Id, 'VNPAY-TEST-20260717', o.TotalAmount, 'PENDING'
FROM Orders o
WHERE o.OrderCode = 'ORDER-20260717-001';
