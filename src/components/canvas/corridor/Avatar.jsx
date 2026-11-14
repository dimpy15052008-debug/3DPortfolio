import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Avatar Component - Hand-drawn sketch style character
 * 
 * New sketchy avatar with WOW effects:
 * - Parallax depth effect on scroll
 * - Hand-drawn line style matching entrance
 * - Dodges when camera approaches
 * - Frame-by-frame animation (Boomerang effect: 1-6-1)
 * - Click to reveal Dimpy's real photo
 */
const Avatar = ({ position = [10, -20, 30] }) => {
    const meshRef = useRef();
    const groupRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 1.2, height: 2.4 });
    const [showPhoto, setShowPhoto] = useState(false);
    const { camera } = useThree();

    // Dodge state
    const dodgeX = useRef(0);
    const targetDodgeX = useRef(0);
    const worldPosVec = useRef(new THREE.Vector3());

    // --- FRAME-BY-FRAME ANIMATION (PING-PONG) ---
    const TOTAL_FRAMES = 9;
    const framePaths = Array.from({ length: TOTAL_FRAMES }, (_, i) => `/textures/corridor/avatar_anim/${i + 1}.webp`);

    // Load all texture frames
    const textures = useTexture(framePaths);

    // Animation control refs
    // start at index 0 (which refers to 1.webp)
    const currentFrame = useRef(0);
    const isReversing = useRef(false);
    const frameTimer = useRef(0);

    // Apply color space and calculate dimensions once
    useEffect(() => {
        textures.forEach(tex => tex.colorSpace = THREE.SRGBColorSpace);

        if (textures[0] && textures[0].image) {
            const aspectRatio = textures[0].image.width / textures[0].image.height;
            const baseHeight = 2.3; // Fixed size
            setDimensions({
                width: baseHeight * aspectRatio,
                height: baseHeight
            });
        }

        // Set initial texture to avoid white flash, but don't bind it declaratively 
        // to prevent React from overwriting our useFrame mutations
        if (meshRef.current && textures[currentFrame.current]) {
            meshRef.current.material.map = textures[currentFrame.current];
            meshRef.current.material.needsUpdate = true;
        }
    }, [textures]);

    // Main animation loop
    useFrame((state, delta) => {
        if (!groupRef.current || !meshRef.current) return;

        // === DODGE LOGIC ===
        groupRef.current.getWorldPosition(worldPosVec.current);
        const distance = camera.position.z - worldPosVec.current.z;

        const DODGE_START = 3;
        const DODGE_PEAK = 0;
        const DODGE_END = -2;
        const DODGE_AMOUNT = -1.5;

        if (distance > DODGE_PEAK && distance < DODGE_START) {
            const t = (DODGE_START - distance) / (DODGE_START - DODGE_PEAK);
            targetDodgeX.current = DODGE_AMOUNT * easeOutQuad(t);
        } else if (distance <= DODGE_PEAK && distance > DODGE_END) {
            const t = (distance - DODGE_END) / (DODGE_PEAK - DODGE_END);
            targetDodgeX.current = DODGE_AMOUNT * easeOutQuad(t);
        } else {
            targetDodgeX.current = 0;
        }

        dodgeX.current = THREE.MathUtils.lerp(dodgeX.current, targetDodgeX.current, 0.08);

        groupRef.current.position.x = position[0] + dodgeX.current;
        groupRef.current.position.y = position[1];

        // === FRAME ANIMATION LOGIC (PING-PONG) ===
        // Using delta for consistent speed regardless of monitor Hz
        const FPS = 20; // Prędkość machania (klatki na sekundę)
        const frameDuration = 1 / FPS;

        frameTimer.current += delta;

        if (frameTimer.current >= frameDuration) {
            frameTimer.current = 0; // Reset timer

            // Jesteśmy na ostatniej (od prawej)? To machamy do lewej
            if (currentFrame.current >= TOTAL_FRAMES - 1) {
                isReversing.current = true;
            }
            // Jesteśmy na indeksie 0 (czyli 1.webp)? To machamy z powrotem do prawej
            else if (currentFrame.current <= 0) {
                isReversing.current = false;
            }

            // Przejście klatki
            if (isReversing.current) {
                currentFrame.current -= 1;
            } else {
                currentFrame.current += 1;
            }

            // Zabezpieczenie przed błędem indeksu (nie schodzimy poniżej 0)
            const safeIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, currentFrame.current));

            // Aplikacja tekstury
            meshRef.current.material.map = textures[safeIndex];
            meshRef.current.material.needsUpdate = true;
        }
    });

    return (
        <group ref={groupRef} position={position}>
            <mesh
                ref={meshRef}
                onClick={(e) => {
                    e.stopPropagation();
                    setShowPhoto(true);
                }}
                onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { document.body.style.cursor = 'default'; }}
            >
                <planeGeometry args={[dimensions.width, dimensions.height]} />
                <meshBasicMaterial color="#ffffff"
                    transparent={true}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>

            {/* Photo Overlay - rendered via React portal to document.body */}
            {showPhoto && createPortal(
                <PhotoOverlay onClose={() => setShowPhoto(false)} />,
                document.body
            )}
        </group>
    );
};

/** Full-screen photo overlay component */
const PhotoOverlay = ({ onClose }) => {
    // Prevent scroll and capture Escape key
    useEffect(() => {
        const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', handleKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed',
                inset: 0,
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1.5rem',
                boxSizing: 'border-box',
                zIndex: 999999,
                cursor: 'pointer',
                animation: 'avatarPhotoFadeIn 0.35s ease-out',
            }}
        >
            <style>{`
                @keyframes avatarPhotoFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes avatarPhotoScaleIn {
                    from { opacity: 0; transform: scale(0.85) translateY(15px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>

            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    position: 'relative',
                    maxWidth: '380px',
                    width: '100%',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'default',
                    animation: 'avatarPhotoScaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
            >
                <img
                    src="/textures/dimpy-photo.jpg"
                    alt="Dimpy Rai"
                    style={{
                        width: '100%',
                        maxHeight: '62vh',
                        objectFit: 'contain',
                        borderRadius: '16px',
                        border: '2px solid rgba(255,255,255,0.25)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 30px rgba(255,255,255,0.1)',
                        display: 'block',
                    }}
                />
                <div style={{
                    textAlign: 'center',
                    marginTop: '1rem',
                    fontFamily: "'Cabin Sketch', cursive",
                }}>
                    <h3 style={{
                        color: '#fff',
                        fontSize: '1.8rem',
                        margin: 0,
                        fontWeight: 700,
                        letterSpacing: '2px',
                        textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                    }}>
                        DIMPY RAI
                    </h3>
                    <p style={{
                        color: 'rgba(255,255,255,0.65)',
                        fontSize: '0.95rem',
                        margin: '0.3rem 0 0',
                        letterSpacing: '1px',
                    }}>
                        Student & Creator
                    </p>
                </div>
            </div>

            {/* Close button */}
            <button
                onClick={onClose}
                aria-label="Close photo"
                style={{
                    position: 'fixed',
                    top: '1.5rem',
                    right: '1.5rem',
                    background: 'rgba(255,255,255,0.12)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderRadius: '50%',
                    width: '46px',
                    height: '46px',
                    color: '#fff',
                    fontSize: '1.4rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    backdropFilter: 'blur(6px)',
                    zIndex: 1000000,
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
                    e.currentTarget.style.transform = 'scale(1.08)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                    e.currentTarget.style.transform = 'scale(1)';
                }}
            >
                ✕
            </button>
        </div>
    );
};

// Easing function
const easeOutQuad = (t) => t * (2 - t);

export default Avatar;
