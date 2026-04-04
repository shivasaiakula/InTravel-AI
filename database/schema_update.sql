CREATE TABLE IF NOT EXISTS reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  destination_name VARCHAR(100) NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS budget_optimizer_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  destination_name VARCHAR(100) NOT NULL,
  mode VARCHAR(30) DEFAULT 'balanced',
  days INT DEFAULT 1,
  total_budget DECIMAL(12, 2) DEFAULT 0,
  payload_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_destination (user_id, destination_name)
);

CREATE TABLE IF NOT EXISTS travel_bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_type VARCHAR(20) NOT NULL,
  user_id INT NULL,
  title VARCHAR(180) NOT NULL,
  city VARCHAR(120) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  details_json JSON,
  status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
