"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { InstancedMesh, Matrix4, Vector3 } from "three";
import type { Position } from "@/lib/analytics-3d/layout";
import type { DividendPulse } from "./use-playback";

const capacity = 8;
const duration = 1600;
type Flow = { start: number; origin: Vector3; bend: Vector3 };

export function DividendParticles({ pulse, positions }: { pulse: DividendPulse | null; positions: ReadonlyMap<string, Position> }) {
  const mesh = useRef<InstancedMesh>(null);
  const pool = useRef<(Flow | null)[]>(Array.from({ length: capacity }, () => null));
  const matrix = useRef(new Matrix4());
  const point = useRef(new Vector3());
  useEffect(() => {
    if (!pulse) { pool.current.fill(null); return; }
    const now = performance.now();
    for (const batch of pulse.batches) {
      if (batch.amount === null || batch.amount <= 0) continue;
      const position = positions.get(batch.key);
      if (!position) continue;
      const slot = pool.current.findIndex((flow) => !flow || now - flow.start >= duration);
      // Visual density is bounded; the HTML notice retains every payment and amount.
      if (slot < 0) break;
      const origin = new Vector3(...position);
      pool.current[slot] = { start: now, origin, bend: origin.clone().multiplyScalar(0.45).add(new Vector3(0, 3, 3)) };
    }
  }, [pulse, positions]);
  useFrame(() => {
    if (!mesh.current) return;
    const now = performance.now();
    for (let slot = 0; slot < capacity; slot++) for (let particle = 0; particle < 3; particle++) {
      const flow = pool.current[slot];
      const t = flow ? (now - flow.start - particle * 90) / (duration - 180) : -1;
      if (!flow || t < 0 || t > 1) matrix.current.makeScale(0, 0, 0);
      else {
        point.current.copy(flow.origin).multiplyScalar((1 - t) ** 2).addScaledVector(flow.bend, 2 * t * (1 - t));
        const radius = 0.07 * Math.sin(Math.PI * t);
        matrix.current.makeScale(radius, radius, radius).setPosition(point.current);
      }
      mesh.current.setMatrixAt(slot * 3 + particle, matrix.current);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={mesh} args={[undefined, undefined, capacity * 3]} frustumCulled={false} raycast={() => {}}>
    <sphereGeometry args={[1, 8, 6]} /><meshBasicMaterial color="#e2c78c" toneMapped={false} />
  </instancedMesh>;
}
