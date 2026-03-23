
-- Create Database
CREATE DATABASE IF NOT EXISTS indian_travel_platform;
USE indian_travel_platform;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Destinations Table
CREATE TABLE IF NOT EXISTS destinations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    description TEXT,
    attractions TEXT,      -- JSON or comma-separated
    best_time VARCHAR(100),
    travel_tips TEXT,
    nearby_places TEXT,
    image_url VARCHAR(255),
    category ENUM('Beach', 'Mountain', 'Heritage', 'City', 'Spiritual', 'Adventure')
);

-- Transport Table (Simplified)
CREATE TABLE IF NOT EXISTS transport (
    id INT AUTO_INCREMENT PRIMARY KEY,
    from_city VARCHAR(100),
    to_city VARCHAR(100),
    mode ENUM('Flight', 'Train', 'Bus'),
    price DECIMAL(10, 2),
    duration VARCHAR(50) -- e.g. "2h 30m"
);

-- Hotels Table
CREATE TABLE IF NOT EXISTS hotels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    city VARCHAR(100),
    name VARCHAR(100),
    price_per_night DECIMAL(10, 2),
    rating DECIMAL(2, 1),
    amenities TEXT,
    image_url VARCHAR(255)
);

-- User Trips Table (Itineraries)
CREATE TABLE IF NOT EXISTS user_trips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    destination_name VARCHAR(100),
    start_date DATE,
    end_date DATE,
    budget_estimate DECIMAL(10, 2),
    itinerary_json JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Initial Mock Data (Destinations)
INSERT INTO destinations (name, state, description, attractions, best_time, travel_tips, nearby_places, category, image_url) VALUES
('Goa', 'Goa', 'Known for its beaches, ranging from popular stretches at Baga and Palolem to those in laid-back fishing villages.', 'Baga Beach, Calangute Beach, Basilica of Bom Jesus', 'November to February', 'Carry sunscreen and rent a scooter for exploring.', 'Gokarna, Hampi', 'Beach', 'https://images.unsplash.com/photo-1540518614846-7eded433c457'),
('Manali', 'Himachal Pradesh', 'A high-altitude Himalayan resort town in India’s northern Himachal Pradesh state.', 'Solang Valley, Rohtang Pass, Hadimba Devi Temple', 'March to June', 'Pack heavy woollens even in summer.', 'Kasol, Shimla', 'Mountain', 'https://images.unsplash.com/photo-1571896349842-33c89424de2d'),
('Jaipur', 'Rajasthan', 'Jaipur is the capital of India’s Rajasthan state. It evokes the royal family that once ruled the region.', 'Amber Fort, Hawa Mahal, City Palace', 'October to March', 'Try the local Dal Baati Churma.', 'Ajmer, Pushkar', 'Heritage', 'https://images.unsplash.com/photo-1546412414-e1885259563a'),
('Kerala', 'Kerala', 'Famous for its backwaters, beaches, and Ayurvedic treatments.', 'Munnar Tea Gardens, Alleppey Backwaters, Wayanad Wildlife Sanctuary', 'September to March', 'Don''t miss the traditional houseboat stay.', 'Kanyakumari, Coimbatore', 'Heritage', 'https://images.unsplash.com/photo-1593181629936-11c609b8db9b'),
('Rishikesh', 'Uttarakhand', 'Located in the Himalayan foothills beside the Ganges River. The river is considered holy.', 'Laxman Jhula, Triveni Ghat, Parmarth Niketan', 'October to May', 'Participate in River Rafting and Ganga Aarti.', 'Haridwar, Dehradun', 'Spiritual', 'https://images.unsplash.com/photo-1593181629936-11c609b8db9b'),
('Ooty', 'Tamil Nadu', 'A resort town in the Western Ghats mountains, in southern India’s Tamil Nadu state.', 'Ooty Lake, Botanical Garden, Doddabetta Peak', 'April to June', 'Ride the Nilgiri Mountain Railway (Toy Train).', 'Coonoor, Mysore', 'Mountain', 'https://images.unsplash.com/photo-1593181629936-11c609b8db9b'),
('Darjeeling', 'West Bengal', 'Darjeeling is a town in India’s West Bengal state, in the Himalayan foothills.', 'Tiger Hill, Batasia Loop, Peace Pagoda', 'April to June, October to December', 'Try the world-famous Darjeeling Tea.', 'Kalimpong, Gangtok', 'Mountain', 'https://images.unsplash.com/photo-1593181629936-11c609b8db9b'),
('Ladakh', 'Ladakh', 'Ladakh is a region administered by India as a union territory, and constituting an part of the larger Kashmir region.', 'Pangong Lake, Leh Palace, Nubra Valley', 'May to September', 'ACCLIMATIZE properly to the high altitude.', 'Srinagar, Kargil', 'Adventure', 'https://images.unsplash.com/photo-1593181629936-11c609b8db9b'),
('Varanasi', 'Uttar Pradesh', 'A city on the banks of the Ganges in Uttar Pradesh, India, 320 kilometres (200 mi) south-east of the state capital, Lucknow.', 'Kashi Vishwanath Temple, Dashashwamedh Ghat, Sarnath', 'October to March', 'Take a morning boat ride in the Ganges.', 'Allahabad, Bodh Gaya', 'Spiritual', 'https://images.unsplash.com/photo-1593181629936-11c609b8db9b'),
('Mumbai', 'Maharashtra', 'Mumbai is the financial capital of India and the home of India’s Bollywood film industry.', 'Gateway of India, Marine Drive, Elephanta Caves', 'October to March', 'Travel in local trains during non-peak hours.', 'Lonavala, Pune', 'City', 'https://images.unsplash.com/photo-1593181629936-11c609b8db9b'),
('Delhi', 'Delhi', 'Indias capital territory, is a massive metropolitan area in the country’s north.', 'Red Fort, Qutub Minar, India Gate', 'October to March', 'Explore the street food in Old Delhi.', 'Agra, Jaipur', 'City', 'https://images.unsplash.com/photo-1593181629936-11c609b8db9b'),
('Hyderabad', 'Telangana', 'A major center for the technology industry, it''s home to many upscale restaurants and shops.', 'Charminar, Golconda Fort, Ramoji Film City', 'September to March', 'Dont forget to eat Hyderabadi Biryani.', 'Warangal, Srisailam', 'City', 'https://images.unsplash.com/photo-1593181629936-11c609b8db9b');

-- Mock Transport Data
INSERT INTO transport (from_city, to_city, mode, price, duration) VALUES
('Delhi', 'Mumbai', 'Flight', 4500.00, '2h 15m'),
('Delhi', 'Mumbai', 'Train', 1200.00, '16h 00m'),
('Mumbai', 'Goa', 'Flight', 3200.00, '1h 10m'),
('Mumbai', 'Goa', 'Bus', 800.00, '12h 00m'),
('Delhi', 'Jaipur', 'Train', 350.00, '4h 30m'),
('Delhi', 'Jaipur', 'Bus', 450.00, '5h 00m');

-- Mock Hotel Data
INSERT INTO hotels (city, name, price_per_night, rating, amenities, image_url) VALUES
('Goa', 'Taj Exotica Resort & Spa', 15000.00, 4.8, 'Pool, Beach Access, Spa, Restaurant', 'https://images.unsplash.com/photo-1540518614846-7eded433c457'),
('Manali', 'The Himalayan Resort', 8000.00, 4.5, 'Mountain View, Fireplace, Restaurant', 'https://images.unsplash.com/photo-1571896349842-33c89424de2d'),
('Jaipur', 'Rambagh Palace', 25000.00, 4.9, 'Grand Garden, Spa, Luxury Dining', 'https://images.unsplash.com/photo-1546412414-e1885259563a');
