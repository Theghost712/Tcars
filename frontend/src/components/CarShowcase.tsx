import { Canvas } from '@react-three/fiber';
import { ContactShadows, Center, OrbitControls, useGLTF } from '@react-three/drei';
import { Suspense, useMemo } from 'react';
import { Box3, Vector3 } from 'three';

const MODEL_URL = '/models/toy-car.glb';

function CarModel() {
  const { scene } = useGLTF(MODEL_URL);
  // Models come in arbitrary units. Scale to a fixed size so the car always fills the frame.
  const scale = useMemo(() => {
    const size = new Box3().setFromObject(scene).getSize(new Vector3());
    const longest = Math.max(size.x, size.y, size.z) || 1;
    return 3.4 / longest;
  }, [scene]);
  return (
    <Center top>
      <primitive object={scene} scale={scale} />
    </Center>
  );
}

/**
 * Interactive 3D preview of a vehicle. Loaded lazily from the home page so the
 * rest of the page is never blocked by the model download.
 */
export default function CarShowcase() {
  return (
    <div className="relative h-full w-full" role="img" aria-label="Interactive 3D car model. Drag to rotate.">
      <Canvas camera={{ position: [2.4, 1.1, 3.1], fov: 35 }} dpr={[1, 2]} shadows>
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 6, 3]} intensity={1.6} castShadow />
        <directionalLight position={[-4, 2, -3]} intensity={0.5} color="#a7f3d0" />
        <Suspense fallback={null}>
          <CarModel />
          <ContactShadows position={[0, -0.01, 0]} opacity={0.5} scale={8} blur={2.4} far={3} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 2.1}
          autoRotate
          autoRotateSpeed={1.2}
        />
      </Canvas>
      <p className="pointer-events-none absolute bottom-3 left-4 text-xs text-white/60">Drag to rotate · 3D preview</p>
    </div>
  );
}

useGLTF.preload(MODEL_URL);
