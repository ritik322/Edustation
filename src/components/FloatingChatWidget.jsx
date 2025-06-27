// src/components/FloatingChatWidget.js
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Maximize2, Minimize2 } from 'lucide-react';
import ChatInterfaceCore from './ChatInterfaceCore'; // Uses the simplified version above

// --- Default Dimensions ---
const SMALL_WIDTH = 400;
const SMALL_HEIGHT = 550;
const SMALL_MARGIN = 30; // Margin from edge for small view
const LARGE_VW = 0.8; // 80vw
const LARGE_VH = 0.8; // 80vh
const LARGE_MARGIN_VW = (1 - LARGE_VW) / 2; // e.g., 0.1 for 10% margin
const LARGE_MARGIN_VH = (1 - LARGE_VH) / 2; // e.g., 0.1 for 10% margin

const FloatingChatWidget = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [targetDimensions, setTargetDimensions] = useState(null); // Holds { width, height, x, y }

    const calculateTarget = (expanded) => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (expanded) {
            return {
                width: vw * LARGE_VW,
                height: vh * LARGE_VH,
                x: vw * LARGE_MARGIN_VW,
                y: vh * LARGE_MARGIN_VH,
            };
        } else {
            const maxWidth = vw - SMALL_MARGIN * 2;
            const maxHeight = vh - SMALL_MARGIN * 2;
            const width = Math.min(SMALL_WIDTH, maxWidth > 0 ? maxWidth : SMALL_WIDTH);
            const height = Math.min(SMALL_HEIGHT, maxHeight > 0 ? maxHeight : SMALL_HEIGHT);
            const x = vw - width - SMALL_MARGIN;
            const y = vh - height - SMALL_MARGIN;
            return { width, height, x, y };
        }
    };

    useLayoutEffect(() => {
        // Calculate initial position only once or when isExpanded changes AFTER mount
        setTargetDimensions(calculateTarget(isExpanded));

        const handleResize = () => {
            setTargetDimensions(calculateTarget(isExpanded));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [isExpanded]); // Recalculate ONLY when isExpanded changes

    const toggleOpen = () => {
        const nextIsOpen = !isOpen;
        if (nextIsOpen && targetDimensions === null) {
            // If opening for the first time and dimensions aren't set, calculate now
            setTargetDimensions(calculateTarget(isExpanded));
        } else if (!nextIsOpen) {
           // Resetting expanded state on close (optional but often desired)
           // If you want it to remember expanded state, remove this line:
           setIsExpanded(false);
        }
        setIsOpen(nextIsOpen);
    };

    const toggleExpand = () => {
        // This will trigger the useLayoutEffect to recalculate dimensions
        setIsExpanded(prev => !prev);
    };

    const canRender = isOpen && targetDimensions !== null;

    // Store drag position locally to avoid re-calculating in state constantly
    const dragPosRef = useRef({x: 0, y: 0});
    useEffect(() => {
        // Update ref when targetDimensions change (e.g. on expand/collapse)
        if (targetDimensions) {
            dragPosRef.current = { x: targetDimensions.x, y: targetDimensions.y };
        }
    }, [targetDimensions]);


    return (
        <>
            {/* Floating Action Button */}
            <motion.button
                key="fab"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="fixed bottom-6 right-6 z-[100] bg-indigo-600 dark:bg-indigo-500 text-white rounded-full p-4 shadow-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                onClick={toggleOpen}
                aria-label={isOpen ? "Close Chat" : "Open Chat"}
            >
                {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
            </motion.button>

            {/* Chat Window */}
            <AnimatePresence>
                {canRender && (
                    <motion.div
                        key="chat-window-motion"
                        className="fixed z-[90] flex flex-col bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg rounded-xl shadow-2xl overflow-hidden border border-gray-300/50 dark:border-gray-700/50"
                        initial={{
                            opacity: 0, scale: 0.9,
                            // Set initial from calculated state
                            x: targetDimensions.x, y: targetDimensions.y,
                            width: targetDimensions.width, height: targetDimensions.height,
                        }}
                        animate={{ // Animate TO current target
                            opacity: 1, scale: 1,
                            x: targetDimensions.x, y: targetDimensions.y,
                            width: targetDimensions.width, height: targetDimensions.height,
                        }}
                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        style={{
                            // Minimal style, motion handles position/size via animate->transform/width/height
                            // Ensure it doesn't conflict with transform
                            left: 0, // Set left/top 0 because transform handles positioning
                            top: 0,
                        }}
                        drag={!isExpanded} // Enable drag only when small
                        dragMomentum={false}
                        dragConstraints={{ top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight }}
                        // --- Use onDrag to update the *ref* directly ---
                        // This avoids excessive state updates during drag
                        onDrag={(event, info) => {
                            if (!isExpanded) {
                                dragPosRef.current = { x: info.point.x, y: info.point.y };
                            }
                         }}
                        // --- Update state only onDragEnd ---
                        onDragEnd={(event, info) => {
                             if (!isExpanded) {
                                // Persist the final dragged position into state
                                 setTargetDimensions(prev => ({ ...prev, x: info.point.x, y: info.point.y }));
                             }
                         }}
                    >
                        {/* Header */}
                        <div
                           className={`bg-gradient-to-r from-indigo-500 to-purple-600 dark:from-indigo-700 dark:to-purple-800 text-white px-3 py-1.5 flex items-center justify-between h-10 shrink-0 ${!isExpanded ? 'cursor-grab' : 'cursor-default'}`}
                        >
                            <span className="font-semibold text-sm flex items-center gap-1.5"> <MessageSquare size={16}/> DocuMind AI </span>
                            <div className="flex items-center gap-1">
                                <button onClick={toggleExpand} className="p-1 rounded-full hover:bg-white/20" aria-label={isExpanded ? "Minimize Chat" : "Maximize Chat"}>
                                    {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                                </button>
                                <button onClick={toggleOpen} className="p-1 rounded-full hover:bg-white/20" aria-label="Close Chat">
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Chat Content Container */}
                        <div className="flex-1 overflow-hidden">
                            {/* Ensure ChatInterfaceCore receives necessary props */}
                            <ChatInterfaceCore
                                isExpanded={isExpanded}
                                user={user}
                                // Pass windowWidth prop if ChatInterfaceCore uses it
                                windowWidth={typeof targetDimensions.width === 'string'
                                    ? window.innerWidth * parseFloat(targetDimensions.width)/100
                                    : targetDimensions.width}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default FloatingChatWidget;