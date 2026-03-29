import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Award, Zap, Target, TrendingUp, CheckCircle2, Lock, Gift, Users } from 'lucide-react';
import './Gamification.css';

const BADGES = [
  { id: 1, name: 'First Explorer', desc: 'Visited your first destination', icon: '🧭', earned: true, xp: 50, rarity: 'Common' },
  { id: 2, name: 'Budget Master', desc: 'Saved ₹10,000+ on a trip', icon: '💰', earned: true, xp: 100, rarity: 'Rare' },
  { id: 3, name: 'Wanderlust', desc: 'Planned 5 unique trips', icon: '✈️', earned: true, xp: 150, rarity: 'Rare' },
  { id: 4, name: 'Mountain Conqueror', desc: 'Visited 3+ mountain destinations', icon: '🏔️', earned: false, xp: 200, rarity: 'Epic', progress: 2, total: 3 },
  { id: 5, name: 'Beach Bum', desc: 'Visited 5 beach destinations', icon: '🏖️', earned: false, xp: 200, rarity: 'Epic', progress: 1, total: 5 },
  { id: 6, name: 'Spiritual Seeker', desc: 'Visited 5 temple destinations', icon: '🛕', earned: false, xp: 250, rarity: 'Epic', progress: 3, total: 5 },
  { id: 7, name: 'AI Power User', desc: 'Generated 10 AI itineraries', icon: '🤖', earned: false, xp: 300, rarity: 'Legendary', progress: 4, total: 10 },
  { id: 8, name: 'Social Butterfly', desc: 'Shared 5 travel stories', icon: '📸', earned: false, xp: 150, rarity: 'Rare', progress: 0, total: 5 },
  { id: 9, name: 'India Maestro', desc: 'Explored all 5 regions of India', icon: '🇮🇳', earned: false, xp: 500, rarity: 'Legendary', progress: 2, total: 5 },
];

const CHALLENGES = [
  { id: 1, name: 'Weekend Warrior', desc: 'Plan a 3-day trip this week', xp: 75, deadline: '2 days left', progress: 60 },
  { id: 2, name: 'Budget Challenger', desc: 'Plan a trip under ₹10,000', xp: 100, deadline: '5 days left', progress: 0 },
  { id: 3, name: 'North India Explorer', desc: 'Visit Delhi, Agra, and Jaipur', xp: 200, deadline: '30 days left', progress: 33 },
  { id: 4, name: 'Monsoon Special', desc: 'Book a trip to Kerala or Meghalaya', xp: 150, deadline: '15 days left', progress: 0 },
];

const LEADERBOARD = [
  { rank: 1, name: 'Ravi K.', xp: 4850, trips: 23, badge: '🥇' },
  { rank: 2, name: 'Priya S.', xp: 4200, trips: 18, badge: '🥈' },
  { rank: 3, name: 'Arjun M.', xp: 3900, trips: 16, badge: '🥉' },
  { rank: 4, name: 'Neha G.', xp: 3400, trips: 14, badge: '4️⃣' },
  { rank: 5, name: 'You', xp: 2850, trips: 8, badge: '5️⃣', isUser: true },
];

const RARITY_COLORS = {
  Common: '#94a3b8',
  Rare: '#6366f1',
  Epic: '#a855f7',
  Legendary: '#f59e0b',
};

const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1600, 2400, 3400, 4600, 6000];

function getLevelInfo(xp) {
  let level = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
  }
  const next = LEVEL_THRESHOLDS[level] || LEVEL_THRESHOLDS[level - 1];
  const prev = LEVEL_THRESHOLDS[level - 1] || 0;
  const pct = Math.min(((xp - prev) / (next - prev)) * 100, 100);
  return { level, next, pct, remaining: Math.max(next - xp, 0) };
}

const LEVEL_TITLES = ['Newbie', 'Explorer', 'Wanderer', 'Adventurer', 'Traveler', 'Voyager', 'Nomad', 'Pioneer', 'Legend', 'Grand Master', 'India God'];

export default function Gamification() {
  const [userXP] = useState(2850);
  const [activeTab, setActiveTab] = useState('badges');
  const [claimedReward, setClaimedReward] = useState(null);
  const { level, pct, remaining } = getLevelInfo(userXP);

  return (
    <div className="gamification-page section-container">
      <div className="section-header">
        <h1 className="heading-gradient"><Trophy size={32} /> Travel Rewards</h1>
        <p>Earn XP, unlock badges, and climb the leaderboard as you explore India!</p>
      </div>

      {/* Level Card */}
      <motion.div className="level-card glass-card" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="level-left">
          <div className="level-badge-big">
            <div className="level-num">{level}</div>
            <div className="level-glow" />
          </div>
          <div className="level-info">
            <div className="level-title">{LEVEL_TITLES[level] || 'Legend'}</div>
            <div className="level-xp">{userXP.toLocaleString()} XP</div>
            <div className="level-xp-muted">{remaining.toLocaleString()} XP to next level</div>
          </div>
        </div>
        <div className="level-right">
          <div className="xp-progress">
            <div className="xp-labels">
              <span>Level {level}</span>
              <span>Level {level + 1}</span>
            </div>
            <div className="xp-bar">
              <motion.div className="xp-fill" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1.2, ease: 'easeOut' }} />
            </div>
            <div className="xp-pct">{Math.round(pct)}% to next level</div>
          </div>
          <div className="level-stats">
            <div className="lstat"><span>8</span><label>Trips</label></div>
            <div className="lstat"><span>{BADGES.filter(b => b.earned).length}</span><label>Badges</label></div>
            <div className="lstat"><span>#5</span><label>Rank</label></div>
            <div className="lstat"><span>3</span><label>Challenges</label></div>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="gam-tabs">
        {['badges', 'challenges', 'leaderboard', 'rewards'].map(tab => (
          <button key={tab} className={`gam-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'badges' && <Award size={16} />}
            {tab === 'challenges' && <Target size={16} />}
            {tab === 'leaderboard' && <Users size={16} />}
            {tab === 'rewards' && <Gift size={16} />}
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Badges Tab */}
        {activeTab === 'badges' && (
          <motion.div key="badges" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="badges-grid">
              {BADGES.map((badge, idx) => (
                <motion.div
                  key={badge.id}
                  className={`badge-card glass-card ${badge.earned ? 'earned' : 'locked'}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -4 }}
                  style={{ '--rarity-color': RARITY_COLORS[badge.rarity] }}
                >
                  {!badge.earned && <div className="lock-overlay"><Lock size={18} /></div>}
                  <div className="badge-emoji">{badge.icon}</div>
                  <div className="badge-rarity" style={{ color: RARITY_COLORS[badge.rarity] }}>{badge.rarity}</div>
                  <h4>{badge.name}</h4>
                  <p>{badge.desc}</p>
                  <div className="badge-xp">+{badge.xp} XP</div>
                  {!badge.earned && badge.progress !== undefined && (
                    <div className="badge-progress">
                      <div className="progress-bar-container">
                        <div className="progress-bar-fill" style={{ width: `${(badge.progress / badge.total) * 100}%` }} />
                      </div>
                      <span>{badge.progress}/{badge.total}</span>
                    </div>
                  )}
                  {badge.earned && <span className="earned-check"><CheckCircle2 size={16} /> Earned</span>}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Challenges Tab */}
        {activeTab === 'challenges' && (
          <motion.div key="challenges" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="challenges-list">
              {CHALLENGES.map((ch, idx) => (
                <motion.div key={ch.id} className="challenge-card glass-card"
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.1 }}>
                  <div className="ch-left">
                    <div className="ch-icon"><Target size={24} /></div>
                    <div>
                      <h4>{ch.name}</h4>
                      <p>{ch.desc}</p>
                    </div>
                  </div>
                  <div className="ch-right">
                    <span className="ch-xp">+{ch.xp} XP</span>
                    <span className="ch-deadline" style={{ color: 'var(--accent-amber)' }}>⏰ {ch.deadline}</span>
                    <div className="ch-progress">
                      <div className="progress-bar-container">
                        <motion.div className="progress-bar-fill" style={{ width: `${ch.progress}%` }}
                          initial={{ width: 0 }} animate={{ width: `${ch.progress}%` }} />
                      </div>
                      <span>{ch.progress}%</span>
                    </div>
                    <button className="button-primary btn-sm">Start →</button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Leaderboard Tab */}
        {activeTab === 'leaderboard' && (
          <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="leaderboard glass-card">
              <div className="lb-header">
                <h3>🏆 India Explorers Leaderboard</h3>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Updated daily</span>
              </div>
              {LEADERBOARD.map((player, idx) => (
                <motion.div
                  key={player.rank}
                  className={`lb-row ${player.isUser ? 'user-row' : ''}`}
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <span className="lb-rank">{player.badge}</span>
                  <div className="lb-avatar">{player.name[0]}</div>
                  <div className="lb-user">
                    <span className="lb-name">{player.name} {player.isUser && '(You)'}</span>
                    <span className="lb-trips">{player.trips} trips</span>
                  </div>
                  <div className="lb-xp-bar">
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill" style={{ width: `${(player.xp / 5000) * 100}%` }} />
                    </div>
                  </div>
                  <span className="lb-xp">{player.xp.toLocaleString()} XP</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Rewards Tab */}
        {activeTab === 'rewards' && (
          <motion.div key="rewards" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="rewards-grid">
              {[
                { name: '₹500 Travel Voucher', cost: 500, icon: '🎫', desc: 'Redeem on hotel bookings', available: true },
                { name: 'Priority AI Planning', cost: 300, icon: '🤖', desc: 'Skip the queue for AI generation', available: true },
                { name: 'Exclusive Destination Guide', cost: 200, icon: '📖', desc: 'Hidden gems PDF for any city', available: true },
                { name: 'Free Airport Transfer', cost: 800, icon: '🚗', desc: 'Partner cab service voucher', available: false },
                { name: 'Premium Hotel Night', cost: 1200, icon: '🏨', desc: '1 free night at partner hotels', available: false },
                { name: 'Lucky Draw Entry', cost: 100, icon: '🎰', desc: 'Win a trip to the Andamans!', available: true },
              ].map((reward, i) => (
                <motion.div key={i} className={`reward-card glass-card ${!reward.available ? 'reward-locked' : ''}`}
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.08 }}>
                  <div className="reward-icon">{reward.icon}</div>
                  <h4>{reward.name}</h4>
                  <p>{reward.desc}</p>
                  <div className="reward-cost">
                    <span className="xp-cost"><Zap size={14} /> {reward.cost} XP</span>
                  </div>
                  <button
                    className={`${reward.available ? 'button-primary' : 'button-secondary'} btn-sm w-full`}
                    disabled={!reward.available || userXP < reward.cost}
                    onClick={() => reward.available && setClaimedReward(reward.name)}
                    style={{ marginTop: '1rem' }}
                  >
                    {!reward.available ? '🔒 Locked' : userXP < reward.cost ? 'Insufficient XP' : 'Redeem'}
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reward Claimed Toast */}
      <AnimatePresence>
        {claimedReward && (
          <motion.div className="reward-toast glass-card"
            initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}>
            🎉 <strong>{claimedReward}</strong> redeemed successfully!
            <button onClick={() => setClaimedReward(null)} style={{ background: 'none', border: 'none', color: 'white', marginLeft: 'auto', cursor: 'pointer' }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
