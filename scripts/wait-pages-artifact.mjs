// Même client et même API de métadonnées que deploy-pages@v4.
// Le client est fourni par l'action ; aucun appel ni dépendance côté navigateur.
export async function waitForPagesArtifact(
  listArtifacts,
  {
    artifactId,
    maxAttempts = 6,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    log = console.info
  } = {}
) {
  if (!/^\d+$/.test(String(artifactId ?? '')) || Number(artifactId) <= 0)
    throw new Error('Identifiant de l’artefact téléversé absent ou invalide. Déploiement arrêté.');
  let confirmations = 0;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Une panne ou un refus d'accès n'est pas traité comme une liste vide.
    const response = await listArtifacts();
    if (!Array.isArray(response?.artifacts)) throw new Error('Métadonnées d’artefacts invalides.');
    const artifacts = response.artifacts.filter((a) => a.name === 'github-pages');
    if (artifacts.length > 1)
      throw new Error('Plusieurs artefacts github-pages : publication ambiguë.');
    if (artifacts.length) {
      const artifact = artifacts[0];
      if (String(artifact.id) !== String(artifactId))
        throw new Error('L’artefact visible ne correspond pas à celui téléversé par ce workflow.');
      if (!Number.isFinite(artifact.size) || artifact.size <= 0 || artifact.expired === true)
        throw new Error('Artefact Pages vide, expiré ou sans taille vérifiable.');
      confirmations++;
      if (confirmations >= 2) {
        log(`Artefact github-pages ${artifactId} confirmé deux fois dans le service GitHub.`);
        return artifact;
      }
    } else confirmations = 0;
    log(`Confirmation de l’artefact Pages en attente (${attempt + 1}/${maxAttempts}).`);
    if (attempt < maxAttempts - 1) await sleep(Math.min(2000 * 2 ** attempt, 30000));
  }
  throw new Error(
    `Artefact github-pages ${artifactId} non stabilisé après ${maxAttempts} lectures. Aucun déploiement lancé ; relancer uniquement la publication Pages.`
  );
}
