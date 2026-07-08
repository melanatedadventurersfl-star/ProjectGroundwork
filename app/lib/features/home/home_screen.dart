import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../design_system/components/groundwork_card.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Groundwork')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            'Good morning, Jonathan',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'Here is what needs attention across your workspaces.',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 24),
          GroundworkCard(
            title: 'Active Workspaces',
            subtitle: 'Start where the work lives.',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Little Camp of Horrors • Planning'),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => context.go('/workspaces'),
                  child: const Text('Open Workspaces'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const GroundworkCard(
            title: 'Today’s Priorities',
            child: Text('Mission Control will surface the next best actions here.'),
          ),
        ],
      ),
    );
  }
}
