#!/usr/usr/env python3
"""
GlobeLens AI — Journalism Pipeline CLI (Rebuilt)
=================================================
Usage examples:

  # Run cluster multi-source demo (3 articles -> 1 synthesis)
  python run_pipeline.py --mode cluster-demo

  # Launch FastAPI server
  python run_pipeline.py --mode serve
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime

if sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
)

# ─── Demo articles (multilingual, SAME EVENT) ────────────────────────────────

DEMO_ARTICLES = [
    {
        "title":        "The Russo-Ukrainian War: A War of Attrition and Innovation",
        "url":          "https://example.com/climate-summit-2026-en",
        "source":       "Reuters",
        "published_at": "2026-06-03",
        "text": """
The war between Russia and Ukraine is the largest and most devastating military conflict in Europe since World War II. What began as a localized territorial dispute has transformed into a prolonged war of attrition with massive geopolitical, economic, and humanitarian consequences worldwide.

The Roots of Conflict (2014–2021)
While the full-scale invasion captured global attention, the war actually began in February 2014. Following Ukraine’s "Revolution of Dignity"—which ousted the country’s pro-Russian president, Viktor Yanukovych—Moscow responded by deploying unmarked military forces to occupy and illegally annex the Crimean Peninsula.

Shortly after, Russia backed and armed separatist proxies in Ukraine’s eastern Donbas region, sparking a localized trench war. Despite the signing of the Minsk II peace agreements in 2015, regular skirmishes continued for nearly eight years, resulting in over 14,000 deaths before the conflict drastically escalated.

The 2022 Full-Scale Invasion
On February 24, 2022, Russian President Vladimir Putin announced a "special military operation," launching a multi-pronged land, sea, and air invasion of Ukraine. The initial Russian objectives included:

Capturing the capital city of Kyiv within days.

Toppling the democratic government of President Volodymyr Zelenskyy.

Enforcing the complete "demilitarization" and neutralization of Ukraine.

Faced with fierce, highly organized Ukrainian resistance and rapid Western intelligence sharing, Russia’s blitzkrieg toward Kyiv failed. By April 2022, Russian forces retreated from the north, shifting their focus to a brutal war of attrition concentrated in the eastern (Donbas) and southern regions of Ukraine.
        """,
    },
    {
        "title":        "Sommet de Genève : un accord historique sur le climat, mais critiqué par les ONG",
        "url":          "https://example.com/climat-geneve-fr",
        "source":       "Le Monde",
        "published_at": "2026-06-03",
        "text": """
        GENÈVE – Au terme de deux semaines de négociations acharnées et de nuits blanches, les dirigeants mondiaux réunis au sommet de l'ONU sur le climat à Genève sont parvenus à un accord qualifié d'« historique ». Le pacte final scelle un engagement global inédit : réduire les émissions de carbone de 50 % d'ici 2035 (par rapport aux niveaux de 2020) et déployer un arsenal financier massif pour amorcer la transition énergétique.

1. Un fonds de 500 milliards de dollars pour le Sud global
Le cœur de cet accord repose sur un compromis financier de grande envergure. Le texte prévoit la création d'un Fonds de transition écologique doté de 500 milliards de dollars.

Objectif : Ce mécanisme vise à subventionner les infrastructures d'énergies renouvelables (solaire, éolien, hydrogène vert) et à financer la reconversion des régions dépendantes du charbon.

Financement : Le fonds sera alimenté de manière tripartite :

L'engagement direct des pays industrialisés (États-Unis, Union Européenne, Japon).

Une contribution progressive des économies émergentes.

Des partenariats public-privé via des obligations vertes.

« Cet accord prouve que la diplomatie climatique n'est pas morte. C'est une action sans précédent qui redéfinit notre trajectoire industrielle pour le siècle à venir », a martelé la présidente américaine Jane Smith lors de la session de clôture.

Pour Washington, ce sommet marque un succès politique majeur, la Maison-Blanche ayant pesé de tout son poids pour rallier les pays hésitants.

2. Les coulisses d'un accord arraché de justesse
L'ambiance à Genève a pourtant frôlé la rupture à plusieurs reprises. Le consensus final cache de profonds compromis géopolitiques :

La clause de flexibilité : Pour obtenir la signature de superpuissances industrielles et de certains pays émergents, une clause de "flexibilité nationale" a été intégrée, permettant d'ajuster les paliers de réduction intermédiaires jusqu'en 2030.

La question des énergies fossiles : Si le texte mentionne l'accélération de la sortie du charbon, les termes concernant le pétrole et le gaz restent flous, évoquant une « transition progressive » plutôt qu'une interdiction stricte.

3. Le réveil douloureux : La colère des ONG environnementales
Malgré l'euphorie des diplomates, la douche est froide pour la société civile. À peine le texte publié, les ONG environnementales ont tiré à boulets rouges sur ce qu'elles considèrent comme une opération de communication.

Pour Greenpeace, cet accord est une occasion manquée qui condamne les objectifs de l'Accord de Paris. Dans un communiqué cinglant, l'organisation a déclaré :

« Les mesures adoptées à Genève sont largement insuffisantes et arrivent beaucoup trop tard. En repoussant l'échéance cruciale à 2035 et en laissant la porte ouverte aux énergies fossiles de transition, cet accord échouera à limiter le réchauffement global à 1,5°C. Les populations les plus vulnérables vont en payer le prix fort. »
   """,
    },
    {
        "title":        "Cumbre del Clima de Ginebra: 180 países firman un acuerdo vinculante",
        "url":          "https://example.com/cumbre-clima-es",
        "source":       "El País",
        "published_at": "2026-06-04",
        "text": """
        GINEBRA — La Cumbre del Clima de las Naciones Unidas, celebrada en Ginebra, concluyó este jueves con la firma de un acuerdo vinculante sin precedentes en la historia de la diplomacia ambiental. Un total de 180 países han suscrito un pacto que obliga a reducir las emisiones globales de carbono en un 50 % antes de 2035, una meta que los expertos climáticos consideran una de las más ambiciosas jamás acordadas en un foro multilateral.

El corazón del acuerdo
El texto firmado en Ginebra establece metas cuantificables y verificables, rompiendo con la tradición de acuerdos climáticos previos que fijaban horizontes temporales más lejanos y carecían de mecanismos de cumplimiento efectivos. Cada país signatario deberá presentar planes nacionales de reducción actualizados cada dos años, sometidos a revisión por un panel independiente de científicos y técnicos de la ONU.

La reducción del 50 % no es una aspiración voluntaria: el acuerdo incluye sanciones comerciales para los países que incumplan sus compromisos sin justificación técnica, una novedad que ha generado intenso debate entre los delegados durante las dos semanas de negociación.

La contribución de China y el nuevo fondo de transición verde
Uno de los momentos más destacados de la cumbre llegó cuando el primer ministro chino, Li Wei, tomó la palabra en la sesión plenaria de clausura para confirmar que la República Popular China aportará 100.000 millones de dólares al nuevo fondo de transición verde.

Esta contribución representa aproximadamente una quinta parte del fondo total de 500.000 millones de dólares que los países desarrollados se han comprometido a movilizar para apoyar a las economías en desarrollo. El anuncio de Li Wei fue recibido con una ovación de pie por parte de la mayoría de los delegados, y marca un punto de inflexión en la participación de China en la financiación climática internacional.

"China no solo es parte del problema, sino también una fuerza fundamental en la construcción de la solución", declaró Li Wei desde la tribuna de la Organización de las Naciones Unidas. "Estos 100.000 millones reflejan nuestra convicción de que la transición energética no puede esperar, y que las naciones emergentes merecen apoyo real, no promesas vacías."

El fondo de transición verde estará destinado a financiar infraestructura de energías renovables, transferencia de tecnología limpia, electrificación del transporte y reconversión industrial sostenible en países que aún dependen del carbón y los combustibles fósiles para su desarrollo económico.

El fondo de Pérdidas y Daños: una victoria agridulce
Junto al acuerdo de reducción de emisiones y el fondo de transición verde, la cumbre logró establecer un fondo de Pérdidas y Daños con una dotación de 50.000 millones de dólares anuales, destinado a compensar a los países más vulnerables que ya sufren los efectos irreversibles del cambio climático: inundaciones, sequías prolongadas, elevación del nivel del mar y degradación de tierras agrícolas.

La creación de este fondo fue celebrada por numerosos delegados como un reconocimiento histórico de la responsabilidad diferenciada entre países industrializados y naciones en desarrollo. Sin embargo, varios delegados africanos expresaron reservas sobre su alcance.

"Es una victoria para la justicia climática, aunque menor de lo esperado", afirmaron representantes de varias naciones del continente africano en rueda de prensa tras la clausura.

Organizaciones de la sociedad civil y países del África subsahariana habían solicitado un fondo de al menos 100.000 millones de dólares anuales, basándose en estimaciones del Banco Mundial y del Panel Intergubernamental sobre Cambio Climático (IPCC) que calculan los daños ya causados en cientos de miles de millones. Los 50.000 millones acordados, aunque representan un avance sin precedentes, cubrirían apenas una fracción de las necesidades reales de las naciones más expuestas.

Reacciones y desafíos pendientes
La comunidad científica ha recibido el acuerdo con optimismo cauteloso. Climatólogos de la Universidad de Oxford y del Instituto de Investigación de Potsdam han calculado que, si se implementa íntegramente, el pacto de Ginebra podría limitar el calentamiento global a aproximadamente 1,7 grados Celsius respecto a los niveles preindustriales, acercándose al umbral aspiracional de 1,5 grados establecido en el Acuerdo de París.

No obstante, los analistas advierten que la brecha entre la firma de un tratado y su aplicación efectiva sigue siendo considerable. La transición energética requeriría, según la Agencia Internacional de Energía, multiplicar por cuatro la capacidad instalada de energías renovables a nivel mundial en los próximos diez años, una tarea que implica inversiones anuales de unos 4 billones de dólares.

El sector privado, representado en Ginebra por consorcios bancarios y fondos de inversión, ha mostrado interés en canalizar capital hacia proyectos de descarbonización, aunque exigen mayor claridad regulatoria y estabilidad política en los países receptores.

Lo que viene
Los 180 países signatarios disponen de 18 meses para ratificar el acuerdo a nivel nacional y presentar sus planes de implementación detallados. La primera revisión de avances está programada para la Cumbre del Clima de 2028, que tendrá lugar en Nairobi.

Mientras los delegados abandonan Ginebra, el mensaje que resuena en los pasillos del Centro Internacional de Conferencias es claro: el mundo ha dibujado un mapa hacia un futuro descarbonizado, pero el camino está lleno de obstáculos políticos, tecnológicos y financieros que solo la voluntad colectiva podrá superar.
""",
    },
]


def mode_cluster_demo(pipeline) -> None:
    print("\n" + "=" * 70)
    print("  GlobeLens AI — Pipeline Demo (Multi-Source Cluster)")
    print("  Ingesting 3 articles about the SAME EVENT (EN, FR, ES)")
    print("=" * 70)

    # 1. Ingest all articles in a single GPU batch.
    #    ingest_batch() sends all sentences from every article through the
    #    translation and embedding models in one pass, keeping the GPU
    #    fully occupied rather than letting it sit idle between articles.
    print(f"\n--- Ingesting {len(DEMO_ARTICLES)} articles as one GPU batch ---")
    batch_results = pipeline.ingest_batch(DEMO_ARTICLES)
    cluster_ids = [cid for cid, _action in batch_results]

    # 2. Trigger Synthesis
    unique_ids = list(dict.fromkeys(cluster_ids))
    clusters = [pipeline.cluster_manager.get_cluster(cid) for cid in unique_ids]
    clusters = [c for c in clusters if c is not None]
    cluster_id = max(clusters, key=lambda c: c.source_count).cluster_id if clusters else None

    print("\n" + "=" * 70)
    print(f"  Triggering Synthesis for Cluster {cluster_id}")
    print("=" * 70)
    
    output = pipeline.synthesize(cluster_id) if cluster_id else None
    
    if not output:
        print("Synthesis failed.")
        return

    # 3. Print Results beautifully
    print("\n\n" + "═" * 80)
    print(f"  SYNTHESIZED REPORT: {output['topic']} ({output['source_count']} Sources)")
    print("═" * 80)
    
    for section_name, sentences in output["sections"].items():
        if not sentences:
            continue
            
        print(f"\n▌ {section_name.upper()}")
        print("  " + "─" * 40)
        
        for sent in sentences:
            text = sent.get("text", "")
            count = sent.get("confirmation_count", 0)
            
            # Find the hover payload for this sentence
            hover = next((p for p in output["hover_payloads"] if p["summary_sentence_id"] == sent.get("sentence_id")), None)
            
            badge = f"[Confirmed by {count}]" if count > 1 else "[Exclusive]"
            print(f"  • {text} {badge}")
            
            if hover and hover["sources"]:
                print("      ↳ Sources cited:")
                for src in hover["sources"][:2]:  # Show top 2 sources
                    print(f"        - {src['outlet']}: \"{src['original_text'][:60]}...\"")
                if len(hover["sources"]) > 2:
                    print(f"        - ...and {len(hover['sources'])-2} more.")
                    
            if hover and hover["contradiction_note"]:
                print(f"      ⚠️  {hover['contradiction_note']}")

    print("\n" + "═" * 80)
    print("  STATISTICS")
    stats = pipeline.get_stats()
    print(json.dumps(stats, indent=2))
    print("═" * 80 + "\n")


def mode_serve(args) -> None:
    import uvicorn
    print(f"Starting FastAPI server on port {args.port}...")
    uvicorn.run("api:app", host="0.0.0.0", port=args.port, reload=False)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="GlobeLens AI — Journalism Summarization Pipeline (V2)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--mode", choices=["cluster-demo", "serve"],
        default="cluster-demo",
        help="Operation mode (default: cluster-demo)",
    )
    parser.add_argument(
        "--ollama-model", default="aya-expanse:8b",
        help="Ollama model for summarization (default: aya-expanse:8b)",
    )
    parser.add_argument("--port", type=int, default=8000, help="Port for API server")

    args = parser.parse_args()

    if args.mode == "serve":
        mode_serve(args)
    else:
        from pipeline import JournalismPipeline
        cluster_storage_path = None
        qdrant_storage_path = None
        if args.mode == "cluster-demo":
            demo_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
            cluster_storage_path = os.path.join(
                os.path.dirname(__file__), "clusters", f"demo_{demo_id}"
            )
            # Allow overriding hugging-face directory via environment variable.
            hf_dir = os.environ.get("HUGGING_FACE_DIR") or os.environ.get("HF_DIR") or os.path.join(
                os.path.dirname(__file__), "hugging-face"
            )
            qdrant_storage_path = os.path.join(hf_dir, f"qdrant_storage_demo_{demo_id}")
        pipeline = JournalismPipeline(
            ollama_model=args.ollama_model,
            use_local_qdrant=True,
            qdrant_storage_path=qdrant_storage_path,
            cluster_storage_path=cluster_storage_path,
        )
        mode_cluster_demo(pipeline)


if __name__ == "__main__":
    main()
