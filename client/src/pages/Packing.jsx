import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, CheckCircle2, Circle, PlusCircle, Trash2, Download, RefreshCw, Search } from 'lucide-react';
import './Packing.css';

const BASE_ITEMS = {
  Essentials: [
    { id: 'e1', name: 'Passport / Aadhar Card', icon: '🪪', packed: false },
    { id: 'e2', name: 'Flight Tickets (Printed)', icon: '✈️', packed: false },
    { id: 'e3', name: 'Hotel Bookings', icon: '🏨', packed: false },
    { id: 'e4', name: 'Travel Insurance', icon: '📄', packed: false },
    { id: 'e5', name: 'Emergency Cash (₹3,000)', icon: '💵', packed: false },
    { id: 'e6', name: 'Phone Charger', icon: '🔌', packed: false },
    { id: 'e7', name: 'Power Bank', icon: '🔋', packed: false },
    { id: 'e8', name: 'Earphones / Headphones', icon: '🎧', packed: false },
  ],
  Clothing: [
    { id: 'c1', name: 'T-Shirts (x5)', icon: '👕', packed: false },
    { id: 'c2', name: 'Trousers / Jeans', icon: '👖', packed: false },
    { id: 'c3', name: 'Underwear (x7)', icon: '🩲', packed: false },
    { id: 'c4', name: 'Socks (x7)', icon: '🧦', packed: false },
    { id: 'c5', name: 'Jacket / Sweater', icon: '🧥', packed: false },
    { id: 'c6', name: 'Comfortable Walking Shoes', icon: '👟', packed: false },
    { id: 'c7', name: 'Flip Flops / Sandals', icon: '🩴', packed: false },
    { id: 'c8', name: 'Belt', icon: '🔗', packed: false },
  ],
  Toiletries: [
    { id: 't1', name: 'Toothbrush & Paste', icon: '🪥', packed: false },
    { id: 't2', name: 'Shampoo & Conditioner', icon: '🧴', packed: false },
    { id: 't3', name: 'Face Wash', icon: '🧼', packed: false },
    { id: 't4', name: 'Sunscreen SPF 50+', icon: '🌞', packed: false },
    { id: 't5', name: 'Deodorant', icon: '💨', packed: false },
    { id: 't6', name: 'Razor / Grooming Kit', icon: '🪒', packed: false },
    { id: 't7', name: 'Moisturizer', icon: '💧', packed: false },
    { id: 't8', name: 'Hand Sanitizer', icon: '🧴', packed: false },
  ],
  Health: [
    { id: 'h1', name: 'First Aid Kit', icon: '🩹', packed: false },
    { id: 'h2', name: 'Prescribed Medicines', icon: '💊', packed: false },
    { id: 'h3', name: 'Paracetamol / Ibuprofen', icon: '💊', packed: false },
    { id: 'h4', name: 'Insect Repellent', icon: '🦟', packed: false },
    { id: 'h5', name: 'ORS Packets', icon: '🫗', packed: false },
    { id: 'h6', name: 'Antacid (Eno/Digene)', icon: '💊', packed: false },
  ],
  Tech: [
    { id: 'tech1', name: 'Camera + Memory Card', icon: '📷', packed: false },
    { id: 'tech2', name: 'Universal Travel Adapter', icon: '🔌', packed: false },
    { id: 'tech3', name: 'Laptop / Tablet', icon: '💻', packed: false },
    { id: 'tech4', name: 'Local SIM Card', icon: '📱', packed: false },
    { id: 'tech5', name: 'Offline Maps Downloaded', icon: '🗺️', packed: false },
  ],
  'Destination-Specific': [],
};

const DESTINATION_EXTRAS = {
  mountain: [
    { id: 'm1', name: 'Thermal Innerwear', icon: '🥶', packed: false },
    { id: 'm2', name: 'Trekking Poles', icon: '🏔️', packed: false },
    { id: 'm3', name: 'Altitude Sickness Medicine', icon: '💊', packed: false },
    { id: 'm4', name: 'Waterproof Rain Jacket', icon: '🧥', packed: false },
    { id: 'm5', name: 'Woolen Gloves & Beanie', icon: '🧤', packed: false },
  ],
  beach: [
    { id: 'b1', name: 'Swimwear', icon: '🩱', packed: false },
    { id: 'b2', name: 'Beach Towel', icon: '🏖️', packed: false },
    { id: 'b3', name: 'Waterproof Phone Pouch', icon: '📱', packed: false },
    { id: 'b4', name: 'Snorkeling Gear', icon: '🤿', packed: false },
    { id: 'b5', name: 'Sunglasses', icon: '🕶️', packed: false },
  ],
  spiritual: [
    { id: 's1', name: 'Modest Clothing (No shorts)', icon: '👗', packed: false },
    { id: 's2', name: 'Head Scarf', icon: '🧕', packed: false },
    { id: 's3', name: 'Worship Offerings (flowers)', icon: '🌸', packed: false },
    { id: 's4', name: 'Comfortable Slip-on Shoes', icon: '👞', packed: false },
  ],
  heritage: [
    { id: 'r1', name: 'Lightweight Cotton Clothes', icon: '👕', packed: false },
    { id: 'r2', name: 'Walking Shoes', icon: '👟', packed: false },
    { id: 'r3', name: 'Sun Hat', icon: '👒', packed: false },
    { id: 'r4', name: 'Water Bottle (2L)', icon: '🫗', packed: false },
  ],
};

export default function PackingPage() {
  const [categorizedItems, setCategorizedItems] = useState({ ...BASE_ITEMS });
  const [destinationType, setDestinationType] = useState('');
  const [search, setSearch] = useState('');
  const [newItem, setNewItem] = useState('');
  const [newCat, setNewCat] = useState('Essentials');
  const [generated, setGenerated] = useState(true);

  const applyDestination = (type) => {
    setDestinationType(type);
    setCategorizedItems(prev => ({
      ...prev,
      'Destination-Specific': DESTINATION_EXTRAS[type] || [],
    }));
  };

  const toggleItem = (cat, id) => {
    setCategorizedItems(prev => ({
      ...prev,
      [cat]: prev[cat].map(item => item.id === id ? { ...item, packed: !item.packed } : item),
    }));
  };

  const removeItem = (cat, id) => {
    setCategorizedItems(prev => ({
      ...prev,
      [cat]: prev[cat].filter(item => item.id !== id),
    }));
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    const item = { id: `custom_${Date.now()}`, name: newItem, icon: '📦', packed: false };
    setCategorizedItems(prev => ({
      ...prev,
      [newCat]: [...(prev[newCat] || []), item],
    }));
    setNewItem('');
  };

  const allItems = Object.values(categorizedItems).flat();
  const packed = allItems.filter(i => i.packed).length;
  const total = allItems.length;
  const pct = total > 0 ? Math.round((packed / total) * 100) : 0;

  const handleDownload = () => {
    const lines = Object.entries(categorizedItems).map(([cat, items]) => {
      return `\n=== ${cat} ===\n` + items.map(i => `[${i.packed ? '✓' : ' '}] ${i.name}`).join('\n');
    }).join('\n');
    const blob = new Blob([`PACKING LIST\n${lines}`], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'packing-list.txt'; a.click();
  };

  const filteredCategories = Object.entries(categorizedItems).map(([cat, items]) => ({
    cat,
    items: search ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : items,
  })).filter(({ items }) => items.length > 0 || !search);

  return (
    <div className="packing-page section-container">
      <div className="section-header">
        <h1 className="heading-gradient"><Package size={32} /> Smart Packing Assistant</h1>
        <p>Never forget a thing — AI-curated packing list based on your destination type.</p>
      </div>

      {/* Destination Type Selector */}
      <div className="dest-type-row glass-card">
        <h3>Select your destination type:</h3>
        <div className="dest-type-grid">
          {[
            { key: 'mountain', label: 'Mountain', icon: '🏔️' },
            { key: 'beach', label: 'Beach', icon: '🏖️' },
            { key: 'spiritual', label: 'Spiritual', icon: '🛕' },
            { key: 'heritage', label: 'Heritage', icon: '🏰' },
          ].map(d => (
            <motion.button
              key={d.key}
              className={`dest-type-btn ${destinationType === d.key ? 'active' : ''}`}
              onClick={() => applyDestination(d.key)}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
            >
              <span>{d.icon}</span> {d.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Progress + Search */}
      <div className="packing-top-bar">
        <div className="packing-progress glass-card">
          <div className="progress-labels">
            <span>Packed: <strong>{packed}/{total}</strong> items</span>
            <span className="progress-pct">{pct}%</span>
          </div>
          <div className="progress-bar-container packing-bar">
            <motion.div
              className="progress-bar-fill"
              animate={{ width: `${pct}%` }}
              style={{ background: pct === 100 ? 'var(--accent-green)' : 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
            />
          </div>
          {pct === 100 && <div className="pack-done">✈️ You're travel-ready!</div>}
        </div>

        <div className="packing-actions">
          <div className="search-bar" style={{ maxWidth: '300px', margin: 0 }}>
            <Search size={18} color="var(--text-muted)" />
            <input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="button-secondary btn-sm" onClick={handleDownload}><Download size={14} /> Export List</button>
        </div>
      </div>

      {/* Add Item Form */}
      <div className="add-item-bar glass-card">
        <input
          placeholder="Add custom item..."
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && addItem()}
          className="add-item-input"
        />
        <select value={newCat} onChange={e => setNewCat(e.target.value)} className="add-cat-select">
          {Object.keys(categorizedItems).map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <button className="button-primary btn-sm" onClick={addItem}><PlusCircle size={14} /> Add</button>
      </div>

      {/* Packing Categories */}
      <div className="packing-grid">
        {filteredCategories.map(({ cat, items }) => {
          const catPacked = items.filter(i => i.packed).length;
          return (
            <motion.div key={cat} className="pack-category glass-card"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="pack-cat-header">
                <h3>{cat}</h3>
                <span className="pack-cat-count">{catPacked}/{items.length}</span>
              </div>
              <div className="progress-bar-container" style={{ marginBottom: '1rem' }}>
                <div className="progress-bar-fill" style={{ width: `${items.length > 0 ? (catPacked / items.length) * 100 : 0}%` }} />
              </div>
              <div className="pack-items">
                <AnimatePresence>
                  {items.map(item => (
                    <motion.div
                      key={item.id}
                      className={`pack-item ${item.packed ? 'packed' : ''}`}
                      layout
                      exit={{ opacity: 0, x: -20 }}
                    >
                      <button className="pack-check" onClick={() => toggleItem(cat, item.id)}>
                        {item.packed
                          ? <CheckCircle2 size={18} color="var(--accent-green)" />
                          : <Circle size={18} color="var(--text-muted)" />
                        }
                      </button>
                      <span className="pack-item-icon">{item.icon}</span>
                      <span className="pack-item-name">{item.name}</span>
                      <button className="pack-remove" onClick={() => removeItem(cat, item.id)}>
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
