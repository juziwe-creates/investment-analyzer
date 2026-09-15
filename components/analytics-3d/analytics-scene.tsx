"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls } from "@react-three/drei";
import { Group, MathUtils, SphereGeometry, TorusGeometry, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { layoutHoldings, sceneBounds, sphereRadius, type Position } from "@/lib/analytics-3d/layout";
import type { UniverseHolding, UniverseModel } from "@/lib/analytics-3d/model";

type Props = {
  model: UniverseModel; mode: "core" | "universe"; selected: string | null; hovered: string | null;
  reducedMotion: boolean; reset: number; onSelect: (key: string | null) => void;
  onHover: (key: string | null) => void; onContextLost: () => void; fallback: ReactNode;
};
const color = { background: "#060b14", brand: "#5075f5", positive: "#4fbc9a", negative: "#d47b85", neutral: "#8c9aaf" };

function Holding({ holding, position, radius, sphere, ring, ...props }: {
  holding: UniverseHolding; position: Position; radius: number; sphere: SphereGeometry; ring: TorusGeometry;
} & Pick<Props, "mode" | "selected" | "hovered" | "reducedMotion" | "onSelect" | "onHover">) {
  const group = useRef<Group>(null);
  const halo = useRef<Group>(null);
  const target = useMemo(() => new Vector3(...position), [position]);
  const active = props.selected === holding.key || props.hovered === holding.key;
  const dim = Boolean(props.hovered && !active);
  const tint = holding.unrealizedGain === null || holding.unrealizedGain === 0 ? color.neutral : holding.unrealizedGain > 0 ? color.positive : color.negative;
  useFrame((_, delta) => {
    if (!group.current) return;
    const speed = props.reducedMotion ? 1 : 1 - Math.exp(-delta * 2.1);
    group.current.position.lerp(props.mode === "universe" ? target : origin, speed);
    const size = props.mode === "universe" ? radius * (active ? 1.1 : 1) : 0.001;
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x, size, speed));
    if (halo.current && !props.reducedMotion) halo.current.rotation.z += delta * 0.025;
  });
  return <group ref={group} scale={0.001}>
    <mesh geometry={sphere} onPointerOver={(event) => { if (props.mode !== "universe") return; event.stopPropagation(); props.onHover(holding.key); }} onPointerOut={() => props.onHover(null)} onClick={(event) => { if (props.mode !== "universe") return; event.stopPropagation(); props.onSelect(holding.key); }}>
      <meshStandardMaterial color={holding.value === null ? "#45515e" : "#193957"} roughness={0.23} metalness={0.75} emissive={tint} emissiveIntensity={dim ? 0.02 : active ? 0.3 : 0.08} />
    </mesh>
    <group ref={halo} rotation={[0.6, -0.3, 0.2]}><mesh geometry={ring} scale={1.14}><meshBasicMaterial color={tint} transparent opacity={dim ? 0.15 : 0.6} /></mesh></group>
    {props.mode === "universe" ? <Html center position={[0, 0, 1.05]} style={{ pointerEvents: "none" }} zIndexRange={[2, 0]}><span style={{ color: "#f0f4ff", fontSize: active ? 13 : 11, fontWeight: 500, opacity: dim ? 0.45 : 1, whiteSpace: "nowrap" }}>{holding.monogram}</span></Html> : null}
  </group>;
}
const origin = new Vector3();

function Core({ mode, reducedMotion, sphere, ring }: Pick<Props, "mode" | "reducedMotion"> & { sphere: SphereGeometry; ring: TorusGeometry }) {
  const group = useRef<Group>(null);
  const inner = useRef<Group>(null);
  useFrame((state, delta) => {
    if (!group.current) return;
    group.current.scale.setScalar(MathUtils.lerp(group.current.scale.x, mode === "core" ? 2.1 : 0.95, reducedMotion ? 1 : 1 - Math.exp(-delta * 2.1)));
    if (inner.current && !reducedMotion) { inner.current.rotation.y += delta * 0.035; inner.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.1) * 0.1; }
  });
  return <group ref={group} scale={2.1}>
    <mesh geometry={sphere}><meshPhysicalMaterial color="#3d6090" metalness={0.3} roughness={0.09} transparent opacity={0.22} depthWrite={false} side={2} /></mesh>
    <mesh geometry={sphere} scale={0.76}><meshStandardMaterial color="#0e2346" roughness={0.22} metalness={0.85} emissive="#173b9b" emissiveIntensity={0.16} /></mesh>
    <group ref={inner} rotation={[0.4, 0.2, -0.3]}>{[0, 1, 2].map((index) => <mesh key={index} geometry={ring} scale={0.9 + index * 0.08} rotation={[index * 0.8, index * 0.6, 0]}><meshBasicMaterial color={index === 1 ? "#90b1fa" : color.brand} transparent opacity={0.45} /></mesh>)}</group>
    <Html center position={[0, 0, 0.85]} style={{ pointerEvents: "none" }} zIndexRange={[1, 0]}><span style={{ fontSize: mode === "core" ? 78 : 26, fontWeight: 400, color: "#b9cfff", lineHeight: 1 }}>α</span></Html>
  </group>;
}

function Contents(props: Props) {
  const { onContextLost } = props;
  const controls = useRef<OrbitControlsImpl>(null);
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const size = useThree((state) => state.size);
  const positions = useMemo(() => layoutHoldings(props.model.holdings), [props.model.holdings]);
  const bounds = useMemo(() => sceneBounds(positions.values()), [positions]);
  const sphere = useMemo(() => new SphereGeometry(1, 40, 24), []);
  const ring = useMemo(() => new TorusGeometry(1, 0.009, 6, 80), []);
  const animation = useRef<{ target: Vector3; camera: Vector3 } | null>(null);
  const maxValue = Math.max(0, ...props.model.holdings.map((holding) => holding.value ?? 0));
  const clusters = useMemo(() => [...new Set(props.model.holdings.map((holding) => holding.sector))].map((sector) => {
    const points = props.model.holdings.filter((holding) => holding.sector === sector).map((holding) => positions.get(holding.key)!);
    return { sector, position: [(Math.min(...points.map((p) => p[0])) + Math.max(...points.map((p) => p[0]))) / 2, Math.max(...points.map((p) => p[1])) + 3, -1] as Position };
  }), [props.model.holdings, positions]);
  useEffect(() => () => { sphere.dispose(); ring.dispose(); }, [sphere, ring]);
  useEffect(() => {
    const point = props.selected ? positions.get(props.selected) : null;
    const target = new Vector3(...(props.mode === "core" ? [0, -0.65, 0] as Position : point ?? bounds.center));
    const distance = props.mode === "core" ? 10.5 : point ? 14 : bounds.radius / Math.sin(Math.PI / 8) / Math.min(1, size.width / size.height) * 1.12;
    animation.current = { target, camera: target.clone().add(new Vector3(0, props.mode === "core" ? 0 : 2, distance)) };
  }, [props.mode, props.selected, props.reset, props.reducedMotion, positions, bounds, size.width, size.height, camera]);
  useFrame((_, delta) => {
    if (!animation.current || !controls.current) return;
    const alpha = props.reducedMotion ? 1 : 1 - Math.exp(-delta * 2.4);
    camera.position.lerp(animation.current.camera, alpha);
    controls.current.target.lerp(animation.current.target, alpha);
    controls.current.update();
    if (camera.position.distanceTo(animation.current.camera) < 0.01) animation.current = null;
  });
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onContextLost(); };
    canvas?.addEventListener("webglcontextlost", lost);
    return () => canvas?.removeEventListener("webglcontextlost", lost);
  }, [canvas, onContextLost]);

  return <>
    <color attach="background" args={[color.background]} />
    <ambientLight intensity={0.7} /><directionalLight position={[8, 10, 12]} intensity={3} color="#bfd5ff" /><directionalLight position={[-8, -4, 4]} intensity={2} color={color.brand} />
    <Environment resolution={128}><Lightformer position={[0, 8, 4]} scale={[20, 2, 1]} intensity={3} /><Lightformer position={[-10, 0, 2]} rotation={[0, Math.PI / 2, 0]} scale={[4, 16, 1]} color="#5075f5" intensity={4} /></Environment>
    <Core mode={props.mode} reducedMotion={props.reducedMotion} sphere={sphere} ring={ring} />
    {props.model.holdings.map((holding) => <Holding key={holding.key} holding={holding} position={positions.get(holding.key)!} radius={sphereRadius(holding.value, maxValue)} sphere={sphere} ring={ring} {...props} />)}
    {props.mode === "universe" ? clusters.map((cluster) => <Html key={cluster.sector} position={cluster.position} center style={{ pointerEvents: "none" }} zIndexRange={[1, 0]}><span style={{ color: "#a9b9cf", fontSize: 11, whiteSpace: "nowrap" }}>{cluster.sector}</span></Html>) : null}
    <OrbitControls ref={controls} makeDefault enabled={props.mode === "universe"} enablePan={false} enableDamping={!props.reducedMotion} dampingFactor={0.08} minDistance={6} maxDistance={Math.max(100, bounds.radius * 6)} minPolarAngle={0.3} maxPolarAngle={Math.PI - 0.3} onStart={() => { animation.current = null; }} />
  </>;
}

export default function AnalyticsScene(props: Props) {
  return <Canvas data-alpha-universe camera={{ position: [0, -0.65, 10.5], fov: 45, near: 0.1, far: 1000 }} dpr={[1, 1.5]} gl={{ antialias: true, powerPreference: "high-performance" }} fallback={props.fallback} onPointerMissed={() => props.onSelect(null)}><Contents {...props} /></Canvas>;
}
