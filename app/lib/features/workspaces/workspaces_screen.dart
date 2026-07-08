import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../design_system/components/groundwork_card.dart';

class WorkspacesScreen extends StatelessWidget {
  const WorkspacesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Workspaces')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          GroundworkCard(
            title: 'Little Camp of Horrors',
            subtitle: 'Experience Workspace • Planning',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Mission Health: On Track'),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => context.go('/workspaces/demo/mission-control'),
                  child: const Text('Open Mission Control'),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          const GroundworkCard(
            title: 'Trailer Inventory',
            subtitle: 'Inventory Workspace • Draft',
            child: Text('Inventory workspace placeholder.'),
          ),
        ],
      ),
    );
  }
}
