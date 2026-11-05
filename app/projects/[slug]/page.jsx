import { notFound } from 'next/navigation';
import Link from 'next/link';
import { projects } from '../../../lib/content';
import Demos from '../../../components/Demos';
export async function generateMetadata({ params }) { const { slug } = await params; return { title: projects.find(p => p.slug === slug)?.name || '作品不存在' }; }
export default async function Project({ params }) { const { slug } = await params; const project = projects.find(p => p.slug === slug); if (!project) notFound(); return <div className="shell inner project-detail"><Link className="back" href="/projects">← 所有作品</Link><div className="page-heading"><span className="eyebrow">{project.en} / DEMO</span><h1>{project.name}</h1><p>{project.detail}</p></div><Demos type={project.type}/></div>; }
