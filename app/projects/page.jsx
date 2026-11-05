import { projects } from '../../lib/content';
import ProjectCard from '../../components/ProjectCard';
export const metadata = { title: '作品集' };
export default function Projects() { return <div className="shell inner"><div className="page-heading"><span className="eyebrow">BUILT WITH CURIOSITY</span><h1>一些小想法，一些小作品。</h1><p>从解决自己的问题开始。这里先放上三个示例，前两个可以直接体验。</p></div><div className="project-grid">{projects.map(p => <ProjectCard key={p.slug} project={p}/>)}</div></div>; }
