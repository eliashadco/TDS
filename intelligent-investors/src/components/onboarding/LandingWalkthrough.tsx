import * as React from 'react';
import { motion } from 'motion/react';
import { Shield, Target, TrendingUp, Zap, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useNavigate } from 'react-router-dom';

export function LandingWalkthrough() {
  const navigate = useNavigate();

  const steps = [
    {
      title: "Strategy-First Operating",
      desc: "TDS isn't a scanner. It's an operating system that forces you to define your rules before you risk your capital.",
      icon: Shield,
      color: "text-blue-500"
    },
    {
      title: "AI-Backed Accountability",
      desc: "Every thesis you write is audited by AI against your specific strategy metrics. No more 'gut feel' entries.",
      icon: Zap,
      color: "text-yellow-500"
    },
    {
      title: "Mechanical Risk Management",
      desc: "Position sizes are computed based on conviction and account heat. We handle the math; you handle the discipline.",
      icon: Target,
      color: "text-red-500"
    }
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full space-y-20">
        <header className="text-center space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block px-4 py-1 bg-gray-100 rounded-full text-[10px] font-mono uppercase tracking-[0.2em] opacity-60"
          >
            The Intelligent Investors Platform
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-serif italic text-6xl md:text-8xl leading-tight"
          >
            Trade with <br /> <span className="text-gray-400">Mechanical</span> Clarity.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl opacity-60 max-w-2xl mx-auto leading-relaxed"
          >
            A doctrine-first trading surface designed to eliminate emotional bias and enforce institutional-grade risk management.
          </motion.p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="space-y-4"
            >
              <div className={`p-3 rounded-xl bg-white border border-[var(--line)] w-fit shadow-sm ${step.color}`}>
                <step.icon size={24} />
              </div>
              <h3 className="font-serif italic text-2xl">{step.title}</h3>
              <p className="text-sm opacity-60 leading-relaxed">{step.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="flex flex-col items-center gap-6 pt-10"
        >
          <Button 
            size="lg" 
            className="h-16 px-10 text-lg font-serif italic gap-4 group"
            onClick={() => navigate('/login')}
          >
            Enter Operating Surface <ArrowRight className="group-hover:translate-x-1 transition-transform" />
          </Button>
          <div className="flex items-center gap-8 text-[10px] font-mono uppercase tracking-widest opacity-40">
            <span className="flex items-center gap-2"><CheckCircle2 size={12} /> Mode Aware</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={12} /> AI Audited</span>
            <span className="flex items-center gap-2"><CheckCircle2 size={12} /> Risk Locked</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
