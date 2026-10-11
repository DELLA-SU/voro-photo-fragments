"""Generate a small eigenfunction texture using QMsolve, in atomic units.
Run: pip install -r scripts/wave-requirements.txt; python scripts/generate_wave.py
The browser evolves the superposition continuously using solved energies.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from qmsolve import Hamiltonian, SingleParticle, eV

np.random.seed(7)
N, extent = 96, 12.0
H = Hamiltonian(particles=SingleParticle(),
    potential=lambda p: 0.5 * (0.24**2 * p.x**2 + 0.31**2 * p.y**2),
    spatial_ndim=2, N=N, extent=extent)
states = H.solve(max_states=3)
basis = states.array.copy()
# Fix arbitrary eigenvector signs for reproducible visual orientation.
for i, state in enumerate(basis):
    peak = np.unravel_index(np.abs(state).argmax(), state.shape)
    if state[peak] < 0: basis[i] *= -1
scales = np.max(np.abs(basis), axis=(1, 2))
encoded = np.rint(np.clip(np.moveaxis(basis / scales[:, None, None], 0, -1)*0.5+0.5, 0, 1)*255).astype('uint8')
out = Path(__file__).resolve().parents[1] / 'dist'
Image.fromarray(encoded).save(out/'wave-basis.png')
energies = states.energies * eV
metadata = dict(generator='qmsolve 2.0.0', model='2D anisotropic harmonic oscillator',
    N=N, extent=extent, frequencies=[0.24, 0.31], energiesHartree=energies.tolist(),
    relativeEnergiesHartree=(energies-energies[0]).tolist(),
    basisScales=scales.tolist(), coefficients=(np.array([0.58, 0.58, 0.5713142743])/np.linalg.norm([0.58, 0.58, 0.5713142743])).tolist(),
    encoding='RGB = three signed real eigenfunctions, normalized individually into [0,255]. Rows run y=-extent/2 to +extent/2.',
    mapping='The real part of the coherent superposition drives depth; spatial differences drive tilt. Artistic relief, not fragment mechanics.')
(out/'wave-model.json').write_text(json.dumps(metadata, indent=2)+'\n')
assert np.all(np.diff(energies)>0) and np.isfinite(basis).all()
norms=np.sum(basis*basis,axis=(1,2))*H.dx**2
assert np.allclose(norms, 1, atol=1e-6), norms
print('energies (hartree):',energies,'normalizations:',norms)
