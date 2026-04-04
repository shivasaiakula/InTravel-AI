import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Compass, Sparkles, BarChart3, Calendar, Map, Package, Trophy, Search, Plane, List } from 'lucide-react';
import './CommandPalette.css';

const RECENT_COMMANDS_KEY = 'intravel-recent-commands';

export default function CommandPalette({ isOpen, onClose }) {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const [recentCommandIds, setRecentCommandIds] = useState(() => {
        try {
            const stored = JSON.parse(localStorage.getItem(RECENT_COMMANDS_KEY) || '[]');
            return Array.isArray(stored) ? stored : [];
        } catch {
            return [];
        }
    });

    useEffect(() => {
        if (!isOpen) {
            setQuery('');
            setActiveIndex(0);
        }
    }, [isOpen]);

    const commands = useMemo(
        () => [
            {
                id: 'go-home',
                label: 'Go to Home',
                hint: 'Main landing page',
                icon: <Compass size={16} />,
                run: () => navigate('/'),
            },
            {
                id: 'go-explore',
                label: 'Open Explore',
                hint: 'Destinations and discovery',
                icon: <Map size={16} />,
                run: () => navigate('/explore'),
            },
            {
                id: 'go-planner',
                label: 'Open AI Planner',
                hint: 'Build itinerary with AI',
                icon: <Sparkles size={16} />,
                run: () => navigate('/planner'),
            },
            {
                id: 'go-transport',
                label: 'Open Transport',
                hint: 'Search and book transport tickets',
                icon: <Plane size={16} />,
                run: () => navigate('/transport'),
            },
            {
                id: 'go-bookings',
                label: 'Open My Bookings',
                hint: 'View hotel and transport reservations',
                icon: <List size={16} />,
                run: () => navigate('/bookings'),
            },
            {
                id: 'go-budget',
                label: 'Open Budget',
                hint: 'Track trip expenses',
                icon: <BarChart3 size={16} />,
                run: () => navigate('/budget'),
            },
            {
                id: 'go-dashboard',
                label: 'Open Dashboard',
                hint: 'Your saved trips and analytics',
                icon: <Calendar size={16} />,
                run: () => navigate('/dashboard'),
            },
            {
                id: 'go-packing',
                label: 'Open Packing',
                hint: 'Packing checklist',
                icon: <Package size={16} />,
                run: () => navigate('/packing'),
            },
            {
                id: 'go-rewards',
                label: 'Open Rewards',
                hint: 'Gamification and badges',
                icon: <Trophy size={16} />,
                run: () => navigate('/gamification'),
            },
        ],
        [navigate],
    );

    const filteredCommands = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        if (!normalizedQuery) {
            const recent = recentCommandIds
                .map((id) => commands.find((cmd) => cmd.id === id))
                .filter(Boolean);

            const remaining = commands.filter((cmd) => !recent.some((recentCmd) => recentCmd.id === cmd.id));
            return [...recent, ...remaining];
        }

        return commands.filter((command) => {
            return (
                command.label.toLowerCase().includes(normalizedQuery)
                || command.hint.toLowerCase().includes(normalizedQuery)
            );
        });
    }, [commands, query, recentCommandIds]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event) => {
            if (!filteredCommands.length) return;

            if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((prev) => (prev + 1) % filteredCommands.length);
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                runCommand(filteredCommands[activeIndex]);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredCommands, activeIndex]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query]);

    const runCommand = (command) => {
        const nextRecent = [command.id, ...recentCommandIds.filter((id) => id !== command.id)].slice(0, 6);
        setRecentCommandIds(nextRecent);
        localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(nextRecent));
        command.run();
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="command-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="command-panel"
                        initial={{ opacity: 0, y: 12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.98 }}
                        transition={{ duration: 0.18 }}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="command-input-row">
                            <Search size={16} />
                            <input
                                autoFocus
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search pages and actions..."
                                aria-label="Command palette search"
                            />
                            <span className="command-kbd">ESC</span>
                        </div>

                        <div className="command-list" role="listbox" aria-label="Command results">
                            {filteredCommands.length === 0 ? (
                                <div className="command-empty">No matching command found.</div>
                            ) : (
                                filteredCommands.map((command) => (
                                    <button
                                        key={command.id}
                                        type="button"
                                        className={`command-item ${filteredCommands[activeIndex]?.id === command.id ? 'active' : ''}`}
                                        onClick={() => runCommand(command)}
                                    >
                                        <span className="command-icon">{command.icon}</span>
                                        <span className="command-main">
                                            <strong>{command.label}</strong>
                                            <small>{command.hint}</small>
                                        </span>
                                    </button>
                                ))
                            )}
                        </div>
                        <div className="command-footer">Tip: use Ctrl/Cmd + K from anywhere</div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
